/** /api/sessions/[id]/start — "Mulai sesi" lifecycle endpoint.
 *
 *  GET — read-only: returns the existing Meet link for this session if a
 *        matching accepted ScheduleBooking already carries one. Never creates.
 *        Used by the Sesi page on mount to populate the hero.
 *
 *  POST — when the mentor presses "▶ Mulai sesi" on the Sebelum panel:
 *    1. Look up the session + pairing.
 *    2. Find the relevant accepted ScheduleBooking for the mentee.
 *    3. If the booking already has a Meet link, return it (idempotent).
 *    4. Otherwise create a Calendar event with a Meet link on the platform
 *       Google Calendar (shared connection — same path the schedule-booking
 *       flow uses via @/lib/google-calendar), persist the eventId + meetLink
 *       on the booking, and return both.
 *    5. Always stamp `prepCompletedAt` on the Session and flip status to
 *       "in_progress".
 *
 *  The client opens `meetLink` in a new tab on success.
 *
 *  Note: this reuses the shared platform calendar connection rather than a
 *  per-mentor OAuth grant (the per-mentor GoogleConnection calendar flow is
 *  deferred). If nobody has connected Google Calendar, event creation is
 *  skipped gracefully — the session still starts, just without a Meet link.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent } from "@/lib/google-calendar";

/** GET — read-only: returns the existing Meet link for this session if any. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("Session")
    .select("id, pairingId")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ meetLink: null });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", session.pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ meetLink: null });

  if (user.role !== "admin" && pairing.mentorId !== user.userId && pairing.menteeId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: bookings } = await supabase
    .from("ScheduleBooking")
    .select("id, sessionId, googleMeetLink, googleCalendarEventId, status")
    .eq("menteeId", pairing.menteeId)
    .eq("status", "accepted")
    .order("createdAt", { ascending: false })
    .limit(10);

  const match = bookings?.find((b) => b.sessionId === session.id && b.googleMeetLink);
  return NextResponse.json({
    meetLink: match?.googleMeetLink ?? null,
    eventId: match?.googleCalendarEventId ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Session + pairing.
  const { data: session } = await supabase
    .from("Session")
    .select("id, sessionNum, topic, scheduledAt, pairingId, prepCompletedAt, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId, mentor:User!mentorId(id, name, email), mentee:User!menteeId(id, name, email)")
    .eq("id", session.pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing tidak ditemukan." }, { status: 404 });

  // Only the mentor (or admin acting on their behalf) can start a session.
  if (user.role !== "admin" && pairing.mentorId !== user.userId) {
    return NextResponse.json({ error: "Hanya mentor sesi ini yang bisa memulai sesi." }, { status: 403 });
  }

  // Find the relevant ScheduleBooking — accepted bookings for this sessionId.
  // Falls back to most recent accepted booking with no sessionId yet.
  const { data: bookings } = await supabase
    .from("ScheduleBooking")
    .select("id, sessionId, googleMeetLink, googleCalendarEventId, requestedStart, requestedEnd, status")
    .eq("menteeId", pairing.menteeId)
    .eq("status", "accepted")
    .order("createdAt", { ascending: false })
    .limit(20);

  const matchedBooking =
    bookings?.find((b) => b.sessionId === session.id) ??
    bookings?.find((b) => !b.sessionId) ??
    null;

  // If the booking already has a Meet link, short-circuit. Idempotent.
  if (matchedBooking?.googleMeetLink) {
    await stampStarted(session.id, session.prepCompletedAt, session.status);
    return NextResponse.json({
      meetLink: matchedBooking.googleMeetLink,
      eventId: matchedBooking.googleCalendarEventId,
      reused: true,
    });
  }

  // Build the event time. Prefer the booking's requested start/end if present,
  // otherwise fall back to the session.scheduledAt with a 60-min slot.
  const startsAt = computeStart(session.scheduledAt, matchedBooking?.requestedStart);
  if (!startsAt) {
    return NextResponse.json(
      { error: "Sesi belum dijadwalkan. Tetapkan jadwal lewat halaman Jadwal dulu." },
      { status: 412 },
    );
  }
  const endsAt = computeEnd(startsAt, matchedBooking?.requestedEnd);

  const mentor = pairing.mentor as unknown as { id: string; name?: string; email?: string } | null;
  const mentee = pairing.mentee as unknown as { id: string; name?: string; email?: string } | null;
  if (!mentor?.email || !mentee?.email) {
    return NextResponse.json({ error: "Mentor / mentee email tidak lengkap." }, { status: 500 });
  }

  // Talk to Calendar via the shared platform connection. Returns null if the
  // platform calendar isn't connected — we then start the session without a
  // Meet link rather than blocking the mentor.
  const result = await createCalendarEvent({
    title: `Sesi ${session.sessionNum}${session.topic ? ` — ${session.topic}` : ""} · Satu Tuju`,
    description: [
      `Sesi mentoring Satu Tuju #${session.sessionNum}`,
      session.topic ? `Topik: ${session.topic}` : null,
      `Mentor: ${mentor.name}`,
      `Mentee: ${mentee.name}`,
      "",
      "Setelah sesi, isi laporan di Satu Tuju → menu Sesi.",
    ]
      .filter(Boolean)
      .join("\n"),
    date: toDatePart(startsAt),
    startTime: toTimePart(startsAt),
    endTime: toTimePart(endsAt),
    attendeeEmails: [mentor.email, mentee.email],
  });

  // Persist on the booking (if there is one + we got a link) and stamp the session.
  if (matchedBooking && result) {
    await supabase
      .from("ScheduleBooking")
      .update({
        googleMeetLink: result.meetLink,
        googleCalendarEventId: result.eventId,
        sessionId: matchedBooking.sessionId ?? session.id, // back-fill the FK if missing
      })
      .eq("id", matchedBooking.id);
  }
  await stampStarted(session.id, session.prepCompletedAt, session.status);

  return NextResponse.json({
    meetLink: result?.meetLink ?? null,
    eventId: result?.eventId ?? null,
    reused: false,
  });
}

async function stampStarted(sessionId: string, prepCompletedAt: string | null, status: string) {
  const nowIso = new Date().toISOString();
  await supabase
    .from("Session")
    .update({
      prepCompletedAt: prepCompletedAt ?? nowIso,
      status: status === "upcoming" ? "in_progress" : status,
      updatedAt: nowIso,
    })
    .eq("id", sessionId);
}

/** Best-effort parser: scheduledAt is "YYYY-MM-DD HH:mm:ss" (naive UTC) +
 *  optional requestedStart "HH:MM" override from the booking. */
function computeStart(scheduledAt: string | null | undefined, requestedStart?: string | null): Date | null {
  if (!scheduledAt) return null;
  const base = parseTs(scheduledAt);
  if (!base) return null;
  if (!requestedStart) return base;
  const [h, m] = requestedStart.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return base;
  const d = new Date(base);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function computeEnd(start: Date, requestedEnd?: string | null): Date {
  const fallback = new Date(start.getTime() + 60 * 60_000);
  if (!requestedEnd) return fallback;
  const [h, m] = requestedEnd.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  const d = new Date(start);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

function parseTs(value: string): Date | null {
  if (!value) return null;
  const s = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(s.endsWith("Z") ? s : s + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** createCalendarEvent expects date ("YYYY-MM-DD") + "HH:MM" wall-clock parts.
 *  We derive them from the UTC instant — consistent with how scheduledAt /
 *  requestedStart are stored. */
function toDatePart(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function toTimePart(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
