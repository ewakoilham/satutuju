import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google-calendar";

// POST: mentee requests a slot
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: slotId } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { message, sessionId, requestedStart, requestedEnd } = await req.json();

  // Fetch slot
  const { data: slot } = await supabase
    .from("ScheduleSlot")
    .select("id, mentorId, status, date, startTime, endTime")
    .eq("id", slotId)
    .single();

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.status !== "available") return NextResponse.json({ error: "Slot is not available" }, { status: 409 });

  // Verify active pairing between mentee and this mentor
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id")
    .eq("menteeId", user.userId)
    .eq("mentorId", slot.mentorId)
    .eq("status", "active")
    .single();

  if (!pairing) return NextResponse.json({ error: "No active pairing with this mentor" }, { status: 403 });

  // No duplicate pending booking
  const { data: existing } = await supabase
    .from("ScheduleBooking")
    .select("id")
    .eq("slotId", slotId)
    .eq("menteeId", user.userId)
    .eq("status", "pending")
    .single();

  if (existing) return NextResponse.json({ error: "You already have a pending request for this slot" }, { status: 409 });

  const now = new Date().toISOString();

  // Create booking
  const { data: booking, error: bookingError } = await supabase
    .from("ScheduleBooking")
    .insert({
      id: crypto.randomUUID(),
      slotId,
      menteeId: user.userId,
      message: message || null,
      sessionId: sessionId || null,
      requestedStart: requestedStart || null,
      requestedEnd: requestedEnd || null,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (bookingError) return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });

  // Set slot to pending
  await supabase.from("ScheduleSlot").update({ status: "pending", updatedAt: now }).eq("id", slotId);

  // Notify mentor — use the requested window if provided, else full slot range
  const reqTimeDisplay = requestedStart && requestedEnd
    ? `${requestedStart}–${requestedEnd}`
    : `${slot.startTime}–${slot.endTime}`;

  await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId: slot.mentorId,
    title: "New Booking Request",
    message: `${user.name} requested your slot on ${slot.date} (${reqTimeDisplay}).`,
    type: "schedule",
    read: false,
    link: "/dashboard/schedule",
    createdAt: now,
  });

  return NextResponse.json({ booking }, { status: 201 });
}

// PATCH: mentor accepts or rejects a booking
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: slotId } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId, action } = await req.json();
  if (!bookingId || !["accept", "reject"].includes(action)) {
    return NextResponse.json({ error: "bookingId and action (accept|reject) required" }, { status: 400 });
  }

  // Verify slot ownership
  const { data: slot } = await supabase
    .from("ScheduleSlot")
    .select("id, mentorId, date, startTime, endTime")
    .eq("id", slotId)
    .single();

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.mentorId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: booking } = await supabase
    .from("ScheduleBooking")
    .select("id, menteeId, status, requestedStart, requestedEnd, sessionId, message, googleCalendarEventId")
    .eq("id", bookingId)
    .eq("slotId", slotId)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  // Allow rejecting both pending and accepted bookings (accepted = mentor cancelling a confirmed session)
  if (action === "accept" && booking.status !== "pending") {
    return NextResponse.json({ error: "Only pending bookings can be accepted" }, { status: 409 });
  }
  if (action === "reject" && booking.status !== "pending" && booking.status !== "accepted") {
    return NextResponse.json({ error: "Booking cannot be cancelled" }, { status: 409 });
  }

  const now = new Date().toISOString();

  if (action === "accept") {
    // Accept this booking
    await supabase
      .from("ScheduleBooking")
      .update({ status: "accepted", updatedAt: now })
      .eq("id", bookingId);

    // Set slot to booked
    await supabase.from("ScheduleSlot").update({ status: "booked", updatedAt: now }).eq("id", slotId);

    // Reject all other pending bookings for this slot
    await supabase
      .from("ScheduleBooking")
      .update({ status: "rejected", updatedAt: now })
      .eq("slotId", slotId)
      .eq("status", "pending")
      .neq("id", bookingId);

    // Notify accepted mentee — use requested window if stored
    const acceptedTimeDisplay = booking.requestedStart && booking.requestedEnd
      ? `${booking.requestedStart}–${booking.requestedEnd}`
      : `${slot.startTime}–${slot.endTime}`;

    await supabase.from("Notification").insert({
      id: crypto.randomUUID(),
      userId: booking.menteeId,
      title: "Booking Accepted",
      message: `Your request for ${slot.date} (${acceptedTimeDisplay}) has been accepted!`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    });

    // --- Google Calendar + Meet link ---
    const [{ data: mentor }, { data: mentee }, { data: admins }] = await Promise.all([
      supabase.from("User").select("name, email").eq("id", slot.mentorId).single(),
      supabase.from("User").select("name, email").eq("id", booking.menteeId).single(),
      supabase.from("User").select("email").eq("role", "admin"),
    ]);

    let sessionLabel = "Mentorship Session";
    if (booking.sessionId) {
      const { data: session } = await supabase
        .from("Session").select("sessionNum, topic").eq("id", booking.sessionId).single();
      if (session) sessionLabel = `Session ${session.sessionNum}: ${session.topic}`;
    }

    const attendeeEmails = [
      mentor?.email, mentee?.email,
      ...(admins || []).map((a: { email: string }) => a.email),
    ].filter(Boolean) as string[];

    const calResult = await createCalendarEvent({
      title: `${sessionLabel} — ${mentor?.name ?? "Mentor"} & ${mentee?.name ?? "Mentee"}`,
      date: slot.date,
      startTime: booking.requestedStart || slot.startTime,
      endTime: booking.requestedEnd || slot.endTime,
      attendeeEmails,
      description: `Satu Tuju Mentorship\n\n${booking.message ? `Mentee note: ${booking.message}` : ""}`,
    });

    if (calResult) {
      await supabase.from("ScheduleBooking")
        .update({ googleCalendarEventId: calResult.eventId, googleMeetLink: calResult.meetLink })
        .eq("id", bookingId);
    }
  } else {
    const wasCancelling = booking.status === "accepted";

    // Delete Google Calendar event if one exists
    if (booking.googleCalendarEventId) {
      await deleteCalendarEvent(booking.googleCalendarEventId);
    }

    // Reject / cancel this booking
    await supabase
      .from("ScheduleBooking")
      .update({ status: "rejected", googleCalendarEventId: null, googleMeetLink: null, updatedAt: now })
      .eq("id", bookingId);

    // Slot always goes back to available when an accepted booking is cancelled
    if (wasCancelling) {
      await supabase.from("ScheduleSlot").update({ status: "available", updatedAt: now }).eq("id", slotId);
    } else {
      // For pending rejections: only revert if no more pending bookings remain
      const { data: remaining } = await supabase
        .from("ScheduleBooking")
        .select("id")
        .eq("slotId", slotId)
        .eq("status", "pending");
      if (!remaining || remaining.length === 0) {
        await supabase.from("ScheduleSlot").update({ status: "available", updatedAt: now }).eq("id", slotId);
      }
    }

    // Notify mentee
    const cancelledTimeDisplay = booking.requestedStart && booking.requestedEnd
      ? `${booking.requestedStart}–${booking.requestedEnd}`
      : `${slot.startTime}–${slot.endTime}`;
    await supabase.from("Notification").insert({
      id: crypto.randomUUID(),
      userId: booking.menteeId,
      title: wasCancelling ? "Session Cancelled" : "Request Rejected",
      message: wasCancelling
        ? `Your mentor cancelled the confirmed session on ${slot.date} (${cancelledTimeDisplay}).`
        : `Your request for ${slot.date} (${cancelledTimeDisplay}) was rejected.`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    });
  }

  return NextResponse.json({ success: true });
}

// DELETE: mentee dismisses their own rejected booking so they can rebook
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: slotId } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentee") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  // Only allow deleting own rejected booking
  const { data: booking } = await supabase
    .from("ScheduleBooking")
    .select("id, menteeId, status")
    .eq("id", bookingId)
    .eq("slotId", slotId)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.menteeId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (booking.status !== "rejected") return NextResponse.json({ error: "Only rejected bookings can be dismissed" }, { status: 409 });

  const { error } = await supabase.from("ScheduleBooking").delete().eq("id", bookingId);
  if (error) return NextResponse.json({ error: "Failed to dismiss booking" }, { status: 500 });

  return NextResponse.json({ success: true });
}
