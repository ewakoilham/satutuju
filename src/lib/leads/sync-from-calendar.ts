import "server-only";

import { supabase } from "@/lib/supabase";
import { maybeAdvanceStage, type LeadStage } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";
import { loadAuth, makeAuthedClient } from "@/lib/integrations/google-calendar";

/**
 * Calendar sync — periodically polls admin@satutuju.id's Google Calendar
 * for new bookings on the appointment schedule URL. When an event's
 * attendee email matches a Lead.email, advance that lead's stage to
 * `call_scheduled` and record the booked time + Meet link.
 *
 * Also detects **cancellations** (events flipped to status=cancelled by
 * either party) and reverts the lead's stage to the one it was in before
 * the booking — provided the admin hasn't already manually moved them
 * past call_scheduled (in which case the call presumably happened and we
 * leave it alone).
 *
 * Run via:
 *   - GET /api/cron/calendar-sync (15-min Vercel cron)
 *   - POST /api/new-leads/calendar-sync (admin-triggered manual sync)
 */

export interface CalendarSyncResult {
  ok: boolean;
  authConnected: boolean;
  eventsFetched: number;
  leadsAdvanced: number;
  leadsReverted: number;
  matches: Array<{
    leadId: string;
    eventId: string;
    summary: string;
    startTime: string;
    meetLink: string | null;
    prevStage: string;
  }>;
  cancellations: Array<{
    leadId: string;
    eventId: string;
    revertedTo: string;
  }>;
  error?: string;
}

/**
 * Look back this far for events when sync runs for the first time
 * (no `lastSyncAt` yet). Past bookings older than this window are
 * skipped — admins can manually advance those stages if needed.
 */
const FIRST_RUN_LOOKBACK_DAYS = 30;

/** Fallback stage to revert to when we can't determine the prior stage
 *  from LeadStageHistory (defensive — should rarely fire since every
 *  call_scheduled transition writes a history row with fromStage). */
const FALLBACK_REVERT_STAGE: LeadStage = "email_clicked";

export async function syncFromCalendar(): Promise<CalendarSyncResult> {
  const auth = await loadAuth();
  if (!auth) {
    return {
      ok: false,
      authConnected: false,
      eventsFetched: 0,
      leadsAdvanced: 0,
      leadsReverted: 0,
      matches: [],
      cancellations: [],
      error: "Not connected to Google Calendar. Visit /api/auth/google to authorize.",
    };
  }

  const calendar = makeAuthedClient(auth.refreshToken);

  // Determine the time window for events.list. On the first sync, look
  // back FIRST_RUN_LOOKBACK_DAYS days. On subsequent syncs, fetch only
  // events updated since the last successful run (incremental).
  const now = new Date();
  const lookbackMs = FIRST_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const updatedMin = auth.lastSyncAt
    ? new Date(auth.lastSyncAt).toISOString()
    : new Date(now.getTime() - lookbackMs).toISOString();
  const timeMin = new Date(now.getTime() - lookbackMs).toISOString();

  let events: Array<{
    id?: string | null;
    status?: string | null;
    summary?: string | null;
    start?: { dateTime?: string | null; date?: string | null } | null;
    attendees?: Array<{ email?: string | null }> | null;
    hangoutLink?: string | null;
  }> = [];

  try {
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      updatedMin,
      singleEvents: true,        // expand recurring events to individual occurrences
      orderBy: "updated",
      maxResults: 250,
      showDeleted: true,         // include status=cancelled events so we can revert
    });
    events = res.data.items ?? [];
  } catch (e) {
    return {
      ok: false,
      authConnected: true,
      eventsFetched: 0,
      leadsAdvanced: 0,
      leadsReverted: 0,
      matches: [],
      cancellations: [],
      error: e instanceof Error ? e.message : "calendar.events.list failed",
    };
  }

  // Build lookup of lead emails for matching new bookings.
  const { data: leads } = await supabase
    .from("Lead")
    .select("id, email, stage, calendarEventId");
  type LeadLite = { id: string; email: string; stage: string; calendarEventId: string | null };
  const byEmail = new Map<string, LeadLite>();
  const byEventId = new Map<string, LeadLite>();
  for (const l of (leads ?? []) as LeadLite[]) {
    byEmail.set(l.email.toLowerCase(), l);
    if (l.calendarEventId) byEventId.set(l.calendarEventId, l);
  }

  const matches: CalendarSyncResult["matches"] = [];
  const cancellations: CalendarSyncResult["cancellations"] = [];
  let leadsAdvanced = 0;
  let leadsReverted = 0;
  const nowIso = now.toISOString();

  for (const ev of events) {
    const eventId = ev.id ?? "";
    if (!eventId) continue;

    // ─── Cancellation branch ────────────────────────────────────────
    if (ev.status === "cancelled") {
      const lead = byEventId.get(eventId);
      // Skip if no lead is tied to this event ID (event we never tracked).
      if (!lead) continue;
      // Skip if admin has already moved the lead past call_scheduled
      // (call happened, no need to revert).
      if (lead.stage !== "call_scheduled") continue;

      // Look up the most recent history row that landed on call_scheduled
      // so we can revert to whatever stage came before.
      const { data: prior } = await supabase
        .from("LeadStageHistory")
        .select("fromStage")
        .eq("leadId", lead.id)
        .eq("toStage", "call_scheduled")
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      const revertTo: LeadStage =
        (prior?.fromStage as LeadStage | null | undefined) ?? FALLBACK_REVERT_STAGE;

      const { error: updErr } = await supabase
        .from("Lead")
        .update({
          stage: revertTo,
          callScheduledAt: null,
          calendarEventId: null,
          updatedAt: nowIso,
        })
        .eq("id", lead.id);
      if (updErr) continue;

      await supabase.from("LeadStageHistory").insert({
        id: newStageHistoryId(),
        leadId: lead.id,
        fromStage: "call_scheduled",
        toStage: revertTo,
        changedBy: "google-calendar-sync",
        note: `Booking cancelled (Google Calendar event ${eventId}) — reverted to ${revertTo}`,
        createdAt: nowIso,
      });

      cancellations.push({ leadId: lead.id, eventId, revertedTo: revertTo });
      leadsReverted++;

      // Update local cache so a later confirmation event in this same
      // run (rare — reschedule on same event ID) doesn't read stale data.
      lead.stage = revertTo;
      lead.calendarEventId = null;
      byEventId.delete(eventId);
      continue;
    }

    // ─── New / updated booking branch ───────────────────────────────
    const summary = ev.summary ?? "(no title)";
    const startTime = ev.start?.dateTime ?? ev.start?.date ?? null;
    const meetLink = ev.hangoutLink ?? null;
    if (!startTime) continue;

    // Try every attendee. First match wins (multiple lead emails on
    // one event is unusual but cheap to handle).
    for (const att of ev.attendees ?? []) {
      const email = att.email?.toLowerCase();
      if (!email) continue;
      const lead = byEmail.get(email);
      if (!lead) continue;

      // Monotonic guard — only advance forward.
      if (!maybeAdvanceStage(lead.stage, "call_scheduled")) continue;

      const { error: updErr } = await supabase
        .from("Lead")
        .update({
          stage: "call_scheduled",
          callScheduledAt: startTime,
          calendarEventId: eventId,
          updatedAt: nowIso,
        })
        .eq("id", lead.id);
      if (updErr) continue;

      await supabase.from("LeadStageHistory").insert({
        id: newStageHistoryId(),
        leadId: lead.id,
        fromStage: lead.stage,
        toStage: "call_scheduled",
        changedBy: "google-calendar-sync",
        note: `Booked via Google Calendar — "${summary}" at ${startTime}${meetLink ? ` (Meet: ${meetLink})` : ""}`,
        createdAt: nowIso,
      });

      matches.push({
        leadId: lead.id,
        eventId,
        summary,
        startTime,
        meetLink,
        prevStage: lead.stage,
      });
      leadsAdvanced++;

      // Keep cache coherent for downstream iterations in this run.
      lead.stage = "call_scheduled";
      lead.calendarEventId = eventId;
      byEventId.set(eventId, lead);
      break; // one match per event
    }
  }

  // Update lastSyncAt to the start of THIS run.
  await supabase
    .from("GoogleCalendarAuth")
    .update({ lastSyncAt: nowIso, updatedAt: nowIso })
    .eq("id", "singleton");

  // Auto-complete the "Schedule initial call" pipeline step for every
  // lead whose stage just advanced to call_scheduled. Safe to call for
  // matches whose stage was already past call_scheduled — the helper
  // only flips pending rows.
  for (const m of matches) {
    await completeStepByTrigger(m.leadId, "call_scheduled").catch(() => {});
  }

  return {
    ok: true,
    authConnected: true,
    eventsFetched: events.length,
    leadsAdvanced,
    leadsReverted,
    matches,
    cancellations,
  };
}
