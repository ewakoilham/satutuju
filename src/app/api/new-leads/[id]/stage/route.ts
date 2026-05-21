import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_STAGES, type StepAutoTrigger } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";

/**
 * Map of stage → pipeline-step autoTrigger that should fire when the
 * lead enters that stage. Kept small & explicit so adding a stage to
 * the funnel doesn't accidentally wire up an unintended step.
 */
const STAGE_TO_STEP_TRIGGER: Partial<Record<string, StepAutoTrigger>> = {
  call_scheduled:  "call_scheduled",
  deposit_pending: "deposit_pending",
  deposit_paid:    "deposit_paid",
  matched:         "matched",
};

/**
 * Change a lead's stage. Writes a LeadStageHistory row capturing the
 * transition + actor + optional note. Free-choice (no monotonicity
 * enforcement) since admin sometimes needs to step backwards.
 *
 * Body: { stage: LeadStage, note?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: { stage?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.stage !== "string" || !(LEAD_STAGES as readonly string[]).includes(body.stage)) {
    return NextResponse.json({ error: "stage must be one of " + LEAD_STAGES.join("|") }, { status: 400 });
  }
  const newStage = body.stage as (typeof LEAD_STAGES)[number];
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  // Fetch current stage so we can record from→to
  const { data: current, error: lookupErr } = await supabase
    .from("Lead")
    .select("stage")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }
  if (current.stage === newStage) {
    // No-op; still return the lead so caller can refresh.
    const { data: leadNoOp } = await supabase
      .from("Lead").select(LEAD_SELECT_COLUMNS).eq("id", id).single();
    return NextResponse.json({ lead: leadNoOp, changed: false });
  }

  const now = new Date().toISOString();
  const { data: lead, error: updErr } = await supabase
    .from("Lead")
    .update({ stage: newStage, updatedAt: now })
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: current.stage,
    toStage: newStage,
    changedBy: user.userId,
    note,
    createdAt: now,
  });

  // Auto-complete any pipeline step whose autoTrigger matches this
  // stage transition (e.g. moving to deposit_paid ticks the
  // "Bersedia Membayar Deposit" step). Helper is no-op if no step
  // listens for the trigger.
  const trigger = STAGE_TO_STEP_TRIGGER[newStage];
  if (trigger) {
    await completeStepByTrigger(id, trigger).catch(() => {});
  }

  return NextResponse.json({ lead, changed: true });
}
