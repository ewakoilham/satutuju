import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  if (user.role === "mentor") {
    // Return own slots with nested bookings (mentee name)
    const { data: slots, error } = await supabase
      .from("ScheduleSlot")
      .select("*, bookings:ScheduleBooking(id, menteeId, message, sessionId, requestedStart, requestedEnd, status, createdAt, mentee:User!ScheduleBooking_menteeId_fkey(name, email))")
      .eq("mentorId", user.userId)
      .order("date", { ascending: true })
      .order("startTime", { ascending: true });

    if (error) return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });

    // Batch-fetch session details for all booking sessionIds
    const sessionIds = [...new Set(
      (slots || []).flatMap((s: { bookings?: { sessionId?: string | null }[] }) =>
        (s.bookings || []).map(b => b.sessionId).filter(Boolean)
      )
    )] as string[];
    const { data: sessionData } = sessionIds.length > 0
      ? await supabase.from("Session").select("id, sessionNum, topic, phase").in("id", sessionIds)
      : { data: [] };
    const sessionMap = new Map((sessionData || []).map((s: { id: string }) => [s.id, s]));

    const slotsWithSessions = (slots || []).map((slot: { bookings?: { sessionId?: string | null }[] }) => ({
      ...slot,
      bookings: (slot.bookings || []).map((b: { sessionId?: string | null }) => ({
        ...b,
        session: b.sessionId ? (sessionMap.get(b.sessionId) ?? null) : null,
      })),
    }));

    return NextResponse.json({ slots: slotsWithSessions });
  }

  if (user.role === "mentee") {
    // Find active pairing → get mentor's slots; join back mentee's own booking per slot
    const { data: pairing } = await supabase
      .from("Pairing")
      .select("id, mentorId")
      .eq("menteeId", user.userId)
      .eq("status", "active")
      .single();

    if (!pairing) return NextResponse.json({ slots: [], hasPairing: false, sessions: [] });

    // Fetch sessions for this pairing (both completed + upcoming)
    const { data: sessions } = await supabase
      .from("Session")
      .select("id, sessionNum, phase, topic, status, scheduledAt")
      .eq("pairingId", pairing.id)
      .order("sessionNum", { ascending: true });

    const { data: slots, error } = await supabase
      .from("ScheduleSlot")
      .select("*, bookings:ScheduleBooking(id, menteeId, message, sessionId, requestedStart, requestedEnd, status)")
      .eq("mentorId", pairing.mentorId)
      .order("date", { ascending: true })
      .order("startTime", { ascending: true });

    if (error) return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });

    // Build session lookup from already-fetched sessions
    const sessionMap = new Map((sessions || []).map((s: { id: string }) => [s.id, s]));

    // Filter bookings to only the current mentee's, and embed session info
    const slotsWithMyBooking = (slots || []).map((slot) => {
      const myBooking = slot.bookings?.find((b: { menteeId: string }) => b.menteeId === user.userId) || null;
      return {
        ...slot,
        myBooking: myBooking
          ? { ...myBooking, session: myBooking.sessionId ? (sessionMap.get(myBooking.sessionId) ?? null) : null }
          : null,
      };
    });

    return NextResponse.json({ slots: slotsWithMyBooking, hasPairing: true, mentorId: pairing.mentorId, sessions: sessions || [] });
  }

  if (user.role === "admin") {
    const mentorId = searchParams.get("mentorId");
    let query = supabase
      .from("ScheduleSlot")
      .select("*, mentor:User!ScheduleSlot_mentorId_fkey(name, email), bookings:ScheduleBooking(id, menteeId, message, sessionId, requestedStart, requestedEnd, status, createdAt, mentee:User!ScheduleBooking_menteeId_fkey(name, email))")
      .order("date", { ascending: true })
      .order("startTime", { ascending: true });

    if (mentorId) query = query.eq("mentorId", mentorId);

    const { data: slots, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });

    // Batch-fetch session details for all booking sessionIds
    const sessionIds = [...new Set(
      (slots || []).flatMap((s: { bookings?: { sessionId?: string | null }[] }) =>
        (s.bookings || []).map((b: { sessionId?: string | null }) => b.sessionId).filter(Boolean)
      )
    )] as string[];
    const { data: sessionData } = sessionIds.length > 0
      ? await supabase.from("Session").select("id, sessionNum, topic, phase").in("id", sessionIds)
      : { data: [] };
    const sessionMap = new Map((sessionData || []).map((s: { id: string }) => [s.id, s]));

    const slotsWithSessions = (slots || []).map((slot: { bookings?: { sessionId?: string | null }[] }) => ({
      ...slot,
      bookings: (slot.bookings || []).map((b: { sessionId?: string | null }) => ({
        ...b,
        session: b.sessionId ? (sessionMap.get(b.sessionId) ?? null) : null,
      })),
    }));

    return NextResponse.json({ slots: slotsWithSessions });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { date, startTime, endTime, notes } = body;

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: "date, startTime, and endTime are required" }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const dur = toMins(endTime) - toMins(startTime);
  if (dur < 60) return NextResponse.json({ error: "Slot must be at least 60 minutes" }, { status: 400 });
  if (dur > 90) return NextResponse.json({ error: "Slot must be at most 90 minutes" }, { status: 400 });

  // Check for overlapping slots on the same day
  const { data: existing } = await supabase
    .from("ScheduleSlot")
    .select("id, startTime, endTime")
    .eq("mentorId", user.userId)
    .eq("date", date);
  const overlaps = (existing || []).some(
    (s: { startTime: string; endTime: string }) =>
      toMins(startTime) < toMins(s.endTime) && toMins(endTime) > toMins(s.startTime)
  );
  if (overlaps) return NextResponse.json({ error: "This slot overlaps an existing slot" }, { status: 409 });

  const now = new Date().toISOString();
  const { data: slot, error } = await supabase
    .from("ScheduleSlot")
    .insert({
      id: crypto.randomUUID(),
      mentorId: user.userId,
      date,
      startTime,
      endTime,
      notes: notes || null,
      status: "available",
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create slot" }, { status: 500 });

  // Notify all active mentees of this mentor
  const { data: pairings } = await supabase
    .from("Pairing")
    .select("menteeId")
    .eq("mentorId", user.userId)
    .eq("status", "active");

  if (pairings && pairings.length > 0) {
    const notifs = pairings.map((p: { menteeId: string }) => ({
      id: crypto.randomUUID(),
      userId: p.menteeId,
      title: "New Availability",
      message: `Your mentor has added a new slot on ${date} (${startTime}–${endTime}).`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    }));
    await supabase.from("Notification").insert(notifs);
  }

  return NextResponse.json({ slot }, { status: 201 });
}
