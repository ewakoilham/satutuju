import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_STAGES, STAGE_TO_STEP_TRIGGER, type LeadStage } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";

/**
 * Change a lead's stage. Writes a LeadStageHistory row capturing the
 * transition + actor + optional note. Free-choice (no monotonicity
 * enforcement) since admin sometimes needs to step backwards.
 *
 * Phase 11: also handles per-stage notes. When stage changes, the
 * outgoing Lead.stageNote is captured into the history row's note
 * (appended after the transition note if provided), then cleared on
 * the Lead row so the next stage starts fresh. A new `stageNote`
 * body field can pre-populate the incoming stage's note.
 *
 * Body: { stage: LeadStage, note?: string, stageNote?: string | null }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: { stage?: unknown; note?: unknown; stageNote?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.stage !== "string" || !(LEAD_STAGES as readonly string[]).includes(body.stage)) {
    return NextResponse.json({ error: "stage must be one of " + LEAD_STAGES.join("|") }, { status: 400 });
  }
  const newStage = body.stage as LeadStage;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  // Incoming-stage note: set on Lead.stageNote after transition. null
  // (explicit) clears; undefined leaves whatever capture does.
  const incomingStageNote = typeof body.stageNote === "string"
    ? body.stageNote.trim().slice(0, 2000) || null
    : body.stageNote === null
      ? null
      : undefined;

  // Fetch current stage + stageNote so we can record from→to and
  // capture the outgoing note into history.
  const { data: current, error: lookupErr } = await supabase
    .from("Lead")
    .select('stage, "stageNote"')
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  if (current.stage === newStage) {
    // Same-stage write: still allow updating stageNote in this path
    // (admin re-affirming with a note without changing stage).
    if (incomingStageNote !== undefined) {
      const { data: leadUpd } = await supabase
        .from("Lead")
        .update({ stageNote: incomingStageNote, updatedAt: new Date().toISOString() })
        .eq("id", id)
        .select(LEAD_SELECT_COLUMNS)
        .single();
      return NextResponse.json({ lead: leadUpd, changed: false });
    }
    const { data: leadNoOp } = await supabase
      .from("Lead").select(LEAD_SELECT_COLUMNS).eq("id", id).single();
    return NextResponse.json({ lead: leadNoOp, changed: false });
  }

  // Capture the outgoing Lead.stageNote into the history row's note.
  // If both a transition note and a stageNote exist, concatenate so
  // neither is lost.
  const outgoingStageNote = (current as { stageNote?: string | null }).stageNote ?? null;
  const composedHistoryNote = [
    note,
    outgoingStageNote ? `[catatan stage ${current.stage}] ${outgoingStageNote}` : null,
  ].filter(Boolean).join("\n").slice(0, 2000) || null;

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    stage: newStage,
    updatedAt: now,
    // Clear outgoing stage note unless caller explicitly set a new one
    // for the incoming stage.
    stageNote: incomingStageNote !== undefined ? incomingStageNote : null,
  };

  const { data: lead, error: updErr } = await supabase
    .from("Lead")
    .update(update)
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
    note: composedHistoryNote,
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
