/** Update / delete one recurring-availability rule.
 *
 *  PATCH  /api/availability/[id]
 *    Body: any subset of { dayOfWeek, startTime, endTime, recurMode,
 *    weeksAhead, notes, active }. Re-materializes after saving — toggling a
 *    rule inactive (or editing its day/time) removes the now-orphaned future
 *    *available* slots and regenerates the new ones.
 *
 *  DELETE /api/availability/[id]
 *    Delete the rule, then re-materialize so its future unbooked slots are
 *    cleaned up. Booked/pending slots survive (the commitment already exists).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { materializeAvailability } from "@/lib/availability-cascade";
import { validateRule } from "../route";

async function loadOwnedRule(id: string, mentorId: string) {
  const { data } = await supabase
    .from("AvailabilityRule")
    .select("id, mentorId, dayOfWeek, startTime, endTime, recurMode, weeksAhead, active, notes")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: NextResponse.json({ error: "Rule not found" }, { status: 404 }) };
  if (data.mentorId !== mentorId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { rule: data };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const owned = await loadOwnedRule(id, user.userId);
  if (owned.error) return owned.error;
  const current = owned.rule;

  const body = await req.json();

  // Merge requested changes onto the current rule, then validate the result as
  // a whole (so a partial edit can't produce an invalid combination).
  const merged = {
    dayOfWeek: body.dayOfWeek ?? current.dayOfWeek,
    startTime: body.startTime ?? current.startTime,
    endTime: body.endTime ?? current.endTime,
    recurMode: body.recurMode ?? current.recurMode,
    weeksAhead: body.recurMode === "unlimited" ? undefined : (body.weeksAhead ?? current.weeksAhead),
  };
  const issue = validateRule(merged);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if ("dayOfWeek" in body) updates.dayOfWeek = body.dayOfWeek;
  if ("startTime" in body) updates.startTime = body.startTime;
  if ("endTime" in body) updates.endTime = body.endTime;
  if ("recurMode" in body) {
    updates.recurMode = body.recurMode;
    updates.weeksAhead = body.recurMode === "fixed" ? merged.weeksAhead : null;
  } else if ("weeksAhead" in body && current.recurMode === "fixed") {
    updates.weeksAhead = body.weeksAhead;
  }
  if ("notes" in body) updates.notes = body.notes;
  if ("active" in body) updates.active = !!body.active;

  const { data: rule, error } = await supabase
    .from("AvailabilityRule")
    .update(updates)
    .eq("id", id)
    .select("id, dayOfWeek, startTime, endTime, recurMode, weeksAhead, active, notes")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });

  const cascade = await materializeAvailability(user.userId);
  return NextResponse.json({ rule, cascade });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const owned = await loadOwnedRule(id, user.userId);
  if (owned.error) return owned.error;

  const { error } = await supabase.from("AvailabilityRule").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });

  const cascade = await materializeAvailability(user.userId);
  return NextResponse.json({ success: true, cascade });
}
