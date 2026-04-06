import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify ownership
  const { data: slot } = await supabase
    .from("ScheduleSlot")
    .select("id, mentorId, date, startTime, endTime, bookings:ScheduleBooking(id, menteeId, status)")
    .eq("id", id)
    .single();

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.mentorId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, string> = {};
  if (body.date) updates.date = body.date;
  if (body.startTime) updates.startTime = body.startTime;
  if (body.endTime) updates.endTime = body.endTime;
  if ("notes" in body) updates.notes = body.notes;

  const effectiveStart = updates.startTime || slot.startTime;
  const effectiveEnd   = updates.endTime   || slot.endTime;
  if (effectiveStart >= effectiveEnd) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }
  const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const dur = toMins(effectiveEnd) - toMins(effectiveStart);
  if (dur < 60) return NextResponse.json({ error: "Slot must be at least 60 minutes" }, { status: 400 });
  if (dur > 90) return NextResponse.json({ error: "Slot must be at most 90 minutes" }, { status: 400 });

  // Check for overlapping slots on the same day (exclude self)
  const effectiveDate = updates.date || slot.date;
  const { data: existing } = await supabase
    .from("ScheduleSlot")
    .select("id, startTime, endTime")
    .eq("mentorId", user.userId)
    .eq("date", effectiveDate)
    .neq("id", id);
  const overlaps = (existing || []).some(
    (s: { startTime: string; endTime: string }) =>
      toMins(effectiveStart) < toMins(s.endTime) && toMins(effectiveEnd) > toMins(s.startTime)
  );
  if (overlaps) return NextResponse.json({ error: "This slot overlaps an existing slot" }, { status: 409 });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("ScheduleSlot")
    .update({ ...updates, updatedAt: now })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to update slot" }, { status: 500 });

  // Clear all rejected bookings — slot time changed, mentees should see it as fresh
  await supabase
    .from("ScheduleBooking")
    .delete()
    .eq("slotId", id)
    .eq("status", "rejected");

  // Notify mentees who have pending/accepted bookings
  const activeBookings = (slot.bookings || []).filter(
    (b: { status: string }) => b.status === "pending" || b.status === "accepted"
  );
  if (activeBookings.length > 0) {
    const newDate = updates.date || slot.date;
    const newStart = updates.startTime || slot.startTime;
    const newEnd = updates.endTime || slot.endTime;
    const notifs = activeBookings.map((b: { menteeId: string }) => ({
      id: crypto.randomUUID(),
      userId: b.menteeId,
      title: "Slot Updated",
      message: `Your mentor updated a slot: ${newDate} (${newStart}–${newEnd}).`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    }));
    await supabase.from("Notification").insert(notifs);
  }

  return NextResponse.json({ slot: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: slot } = await supabase
    .from("ScheduleSlot")
    .select("id, mentorId, date, startTime, endTime, bookings:ScheduleBooking(id, menteeId, status)")
    .eq("id", id)
    .single();

  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.mentorId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Delete Google Calendar events for bookings with events
  const bookingsWithEvents = (slot.bookings || []).filter(
    (b: { googleCalendarEventId?: string }) => b.googleCalendarEventId
  );
  if (bookingsWithEvents.length > 0) {
    await Promise.all(
      bookingsWithEvents.map((b: { googleCalendarEventId: string }) => deleteCalendarEvent(b.googleCalendarEventId))
    );
  }

  // Notify mentees with active bookings before deleting
  const activeBookings = (slot.bookings || []).filter(
    (b: { status: string }) => b.status === "pending" || b.status === "accepted"
  );
  if (activeBookings.length > 0) {
    const now = new Date().toISOString();
    const notifs = activeBookings.map((b: { menteeId: string }) => ({
      id: crypto.randomUUID(),
      userId: b.menteeId,
      title: "Slot Cancelled",
      message: `Your mentor cancelled the slot on ${slot.date} (${slot.startTime}–${slot.endTime}).`,
      type: "schedule",
      read: false,
      link: "/dashboard/schedule",
      createdAt: now,
    }));
    await supabase.from("Notification").insert(notifs);
  }

  const { error } = await supabase.from("ScheduleSlot").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete slot" }, { status: 500 });

  return NextResponse.json({ success: true });
}
