import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

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

  if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
    return NextResponse.json({ error: "startTime must be before endTime" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("ScheduleSlot")
    .update({ ...updates, updatedAt: now })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to update slot" }, { status: 500 });

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
