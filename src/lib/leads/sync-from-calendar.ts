import "server-only";

import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { LEAD_STAGES } from "@/lib/leads/types";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";
import { loadAuth, makeAuthedClient } from "@/lib/integrations/google-calendar";

/**
 * Calendar sync — periodically polls admin@satutuju.id's Google Calendar
 * for new bookings on the appointment schedule URL. When an event's
 * attendee email matches a Lead.email, advance that lead's stage to
 * `call_scheduled` and record the booked time + Meet link.
 *
 * Run via:
 *   - GET /api/cron/calendar-sync (hourly Vercel cron)
 *   - POST /api/new-leads/calendar-sync (admin-triggered manual sync)
 */

export interface CalendarSyncResult {
  ok: boolean;
  authConnected: boolean;
  eventsFetched: number;
  leadsAdvanced: number;
  matches: Array<{
    leadId: string;
    eventId: string;
    summary: string;
    startTime: string;
    meetLink: string | null;
    prevStage: string;
  }>;
  error?: string;
}

/** Stage advancement is monotonic — only forward in LEAD_STAGES order. */
function isStageBefore(current: string, target: string): boolean {
  const order = LEAD_STAGES as readonly string[];
  const ci = order.indexOf(current);
  const ti = order.indexOf(target);
  return ci >= 0 && ti >= 0 && ci < ti;
}

function historyId(): string {
  return "lsh_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

/**
 * Look back this far for events when sync runs for the first time
 * (no `lastSyncAt` yet). Past bookings older than this window are
 * skipped — admins can manually advance those stages if needed.
 */
const FIRST_RUN_LOOKBACK_DAYS = 30;

export async function syncFromCalendar(): Promise<CalendarSyncResult> {
  const auth = await loadAuth();
  if (!auth) {
    return {
      ok: false,
      authConnected: false,
      eventsFetched: 0,
      leadsAdvanced: 0,
      matches: [],
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
  // Don't fetch events in the past relative to "now"; the appointment
  // already happened. But DO include events that were updated recently
  // (rescheduled).
  const timeMin = new Date(now.getTime() - lookbackMs).toISOString();

  let events: Array<{
    id?: string | null;
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
      singleEvents: true,           // expand recurring events to individual occurrences
      orderBy: "updated",
      maxResults: 250,
      showDeleted: false,
    });
    events = res.data.items ?? [];
  } catch (e) {
    return {
      ok: false,
      authConnected: true,
      eventsFetched: 0,
      leadsAdvanced: 0,
      matches: [],
      error: e instanceof Error ? e.message : "calendar.events.list failed",
    };
  }

  // Build a quick lookup of lead emails for matching. We only care about
  // leads that aren't already past `call_scheduled` (monotonic guard).
  const { data: leads } = await supabase
    .from("Lead")
    .select("id, email, stage");
  type LeadLite = { id: string; email: string; stage: string };
  const byEmail = new Map<string, LeadLite>();
  for (const l of (leads ?? []) as LeadLite[]) {
    byEmail.set(l.email.toLowerCase(), l);
  }

  const matches: CalendarSyncResult["matches"] = [];
  let leadsAdvanced = 0;
  const nowIso = now.toISOString();

  for (const ev of events) {
    const eventId = ev.id ?? "";
    const summary = ev.summary ?? "(no title)";
    const startTime = ev.start?.dateTime ?? ev.start?.date ?? null;
    const meetLink = ev.hangoutLink ?? null;
    if (!startTime || !eventId) continue;

    // Try every attendee. First match wins (multiple lead emails on
    // one event is unusual but cheap to handle).
    for (const att of ev.attendees ?? []) {
      const email = att.email?.toLowerCase();
      if (!email) continue;
      const lead = byEmail.get(email);
      if (!lead) continue;

      // Monotonic guard — only advance forward.
      if (!isStageBefore(lead.stage, "call_scheduled")) continue;

      // Advance Lead.stage + set callScheduledAt.
      const { error: updErr } = await supabase
        .from("Lead")
        .update({
          stage: "call_scheduled",
          callScheduledAt: startTime,
          updatedAt: nowIso,
        })
        .eq("id", lead.id);
      if (updErr) continue;

      // Write LeadStageHistory entry.
      await supabase.from("LeadStageHistory").insert({
        id: historyId(),
        leadId: lead.id,
        fromStage: lead.stage,
        toStage: "call_scheduled",
        changedBy: "google-calendar-sync",
        note: `Booked via Google Calendar — "${summary}" at ${startTime}${meetLink ? ` (Meet: ${meetLink})` : ""}`,
        createdAt: nowIso,
      });

      // Auto-complete any step listening for "call_scheduled" trigger
      // (no current default step uses this, but admin may add one).
      // The trigger string isn't in our STEP_AUTO_TRIGGERS enum yet so
      // we'd need to add it; skipping for now and letting admin tick
      // the "Schedule initial call" step manually.

      matches.push({
        leadId: lead.id,
        eventId,
        summary,
        startTime,
        meetLink,
        prevStage: lead.stage,
      });
      leadsAdvanced++;
      break; // one match per event
    }
  }

  // Update lastSyncAt to the start of THIS run (so the next run picks up
  // events updated DURING this run on its next pass).
  await supabase
    .from("GoogleCalendarAuth")
    .update({ lastSyncAt: nowIso, updatedAt: nowIso })
    .eq("id", "singleton");

  // No step trigger uses "call_scheduled" by default but keeping the
  // hook here if admin adds one later via the Pipeline manager.
  for (const m of matches) {
    await completeStepByTrigger(m.leadId, "matched").catch(() => {
      /* noop — no step listens for matched at this stage */
    });
  }

  return {
    ok: true,
    authConnected: true,
    eventsFetched: events.length,
    leadsAdvanced,
    matches,
  };
}
