/** POST /api/sessions/[id]/start — Phase D.3 of the v5 redesign.
 *
 *  When the mentor presses "▶ Mulai sesi" on the Sebelum panel:
 *    1. Look up the session + pairing + mentor's Google connection.
 *    2. If the booking already has a Meet link, return it (idempotent).
 *    3. Otherwise create a Calendar event on the mentor's primary calendar
 *       with a Meet link attached (mentee added as attendee), save the
 *       eventId + meetLink on the ScheduleBooking row, and return both.
 *    4. Always stamp `prepCompletedAt` on the Session and flip status to
 *       "in_progress".
 *
 *  The client opens `meetLink` in a new tab on success.
 *
 *  Errors:
 *    409 — already started, no booking to attach the link to
 *    412 — mentor hasn't connected Google Calendar yet, or didn't grant
 *          the calendar.events scope. Body includes `needsConnect: true`
 *          and a `connectUrl` the client redirects to.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { createMeetEvent, NotConnected, MissingCalendarScope } from "@/lib/google-meet";

/** GET — read-only: returns the existing Meet link for this session if any.
 *  Used by the Sesi page on mount to populate the hero. Never creates.
 */
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
    .select("id, sessionId, googleMeetLink, meetEventId, status")
    .eq("menteeId", pairing.menteeId)
    .eq("status", "accepted")
    .order("createdAt", { ascending: false })
    .limit(10);

  const match = bookings?.find((b) => b.sessionId === session.id && b.googleMeetLink);
  return NextResponse.json({
    meetLink: match?.googleMeetLink ?? null,
    eventId: match?.meetEventId ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  // Falls back to most recent accepted booking if no explicit FK match.
  const { data: bookings } = await supabase
    .from("ScheduleBooking")
    .select("id, sessionId, googleMeetLink, meetEventId, requestedStart, requestedEnd, status")
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
      eventId: matchedBooking.meetEventId,
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

  // Talk to Calendar.
  let result: { eventId: string; meetLink: string };
  try {
    result = await createMeetEvent({
      mentorUserId: pairing.mentorId,
      title: `Sesi ${session.sessionNum}${session.topic ? ` — ${session.topic}` : ""} · Satu Tuju`,
      description: [
        `Sesi mentoring Satu Tuju #${session.sessionNum}`,
        session.topic ? `Topik: ${session.topic}` : null,
        `Mentor: ${mentor.name}`,
        `Mentee: ${mentee.name}`,
        "",
        "Setelah sesi, isi laporan di Satu Tuju → menu Sesi.",
      ].filter(Boolean).join("\n"),
      startsAt,
      endsAt,
      attendeeEmails: [mentor.email, mentee.email],
    });
  } catch (err) {
    if (err instanceof NotConnected || err instanceof MissingCalendarScope) {
      return NextResponse.json(
        {
          error: err.message,
          needsConnect: true,
          connectUrl: `/api/auth/google?mode=connect&next=${encodeURIComponent(req.headers.get("referer") || "/dashboard/sesi/" + session.id)}`,
        },
        { status: 412 },
      );
    }
    console.error("[start] createMeetEvent failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat Meet." },
      { status: 502 },
    );
  }

  // Persist on the booking (if there is one) and stamp the session.
  if (matchedBooking) {
    await supabase
      .from("ScheduleBooking")
      .update({
        googleMeetLink: result.meetLink,
        meetEventId: result.eventId,
        sessionId: matchedBooking.sessionId ?? session.id, // back-fill the FK if missing
      })
      .eq("id", matchedBooking.id);
  }
  await stampStarted(session.id, session.prepCompletedAt, session.status);

  return NextResponse.json({
    meetLink: result.meetLink,
    eventId: result.eventId,
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
