/** GET/POST /api/sessions/[id]/start
 *
 *  The session's Google Meet is created once, on the platform calendar, at the
 *  moment the mentor accepts the booking (see src/lib/google-calendar.ts via
 *  /api/schedule/[id]/book). This route does NOT create meetings — it only
 *  surfaces the link that already exists and moves the session into its
 *  running state.
 *
 *    GET  → read-only: returns the existing Meet link for this session, if any.
 *           Used by the Sesi page on mount to populate the hero. Never mutates.
 *
 *    POST → "▶ Mulai sesi": stamp prepCompletedAt + flip status to
 *           "in_progress", and return the existing Meet link so the client can
 *           open it. If no link exists yet (booking not accepted, or the
 *           platform calendar wasn't configured at accept time), the session
 *           still starts but the response carries a `warning` and a null link.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const NO_LINK_WARNING =
  "Tautan Google Meet belum tersedia. Tautan dibuat otomatis saat jadwal sesi diterima — pastikan booking sesi ini sudah dikonfirmasi di halaman Jadwal.";

/** Find the accepted booking that carries this session's meeting. Prefers an
 *  exact sessionId match with a link, then any match, then any accepted
 *  booking that has a link. */
async function findMeetingBooking(menteeId: string, sessionId: string) {
  const { data: bookings } = await supabase
    .from("ScheduleBooking")
    .select("id, sessionId, googleMeetLink, googleCalendarEventId, status, createdAt")
    .eq("menteeId", menteeId)
    .eq("status", "accepted")
    .order("createdAt", { ascending: false })
    .limit(20);

  return (
    bookings?.find((b) => b.sessionId === sessionId && b.googleMeetLink) ??
    bookings?.find((b) => b.sessionId === sessionId) ??
    bookings?.find((b) => b.googleMeetLink) ??
    null
  );
}

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

  const match = await findMeetingBooking(pairing.menteeId, session.id);
  return NextResponse.json({
    meetLink: match?.googleMeetLink ?? null,
    eventId: match?.googleCalendarEventId ?? null,
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("Session")
    .select("id, pairingId, prepCompletedAt, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId")
    .eq("id", session.pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing tidak ditemukan." }, { status: 404 });

  // Only the mentor (or an admin acting on their behalf) can start a session.
  if (user.role !== "admin" && pairing.mentorId !== user.userId) {
    return NextResponse.json({ error: "Hanya mentor sesi ini yang bisa memulai sesi." }, { status: 403 });
  }

  const match = await findMeetingBooking(pairing.menteeId, session.id);

  // Move the session into its running state regardless of link availability.
  await stampStarted(session.id, session.prepCompletedAt, session.status);

  const meetLink = match?.googleMeetLink ?? null;
  return NextResponse.json({
    meetLink,
    eventId: match?.googleCalendarEventId ?? null,
    reused: !!meetLink,
    ...(meetLink ? {} : { warning: NO_LINK_WARNING }),
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
