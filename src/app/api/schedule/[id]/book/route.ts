import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

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

  // Notify mentor
  await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId: slot.mentorId,
    title: "New Booking Request",
    message: `${user.name} requested your slot on ${slot.date} (${slot.startTime}–${slot.endTime}).`,
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
    .select("id, menteeId, status")
    .eq("id", bookingId)
    .eq("slotId", slotId)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "pending") return NextResponse.json({ error: "Booking is not pending" }, { status: 409 });

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

    // Notify accepted mentee
    await supabase.from("Notification").insert({
      id: crypto.randomUUID(),
      userId: booking.menteeId,
      title: "Booking Accepted",
      message: `Your request for the slot on ${slot.date} (${slot.startTime}–${slot.endTime}) has been accepted!`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    });
  } else {
    // Reject this booking
    await supabase
      .from("ScheduleBooking")
      .update({ status: "rejected", updatedAt: now })
      .eq("id", bookingId);

    // If no more pending bookings → slot back to available
    const { data: remaining } = await supabase
      .from("ScheduleBooking")
      .select("id")
      .eq("slotId", slotId)
      .eq("status", "pending");

    if (!remaining || remaining.length === 0) {
      await supabase.from("ScheduleSlot").update({ status: "available", updatedAt: now }).eq("id", slotId);
    }
  }

  return NextResponse.json({ success: true });
}
