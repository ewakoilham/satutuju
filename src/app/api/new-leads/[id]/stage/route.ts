import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_STAGES, STAGE_TO_STEP_TRIGGER, encodeStageNote, type LeadStage, type StepAutoTrigger } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepsByTriggers } from "@/lib/leads/step-helpers";

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
    .single<{ stage: LeadStage; stageNote: string | null }>();
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

  // Compose the history row's note: transition note + incoming stage
  // note (tied to destination stage) + outgoing stage note (parked
  // value from the stage we're leaving). Both stage notes are wrapped
  // with the shared marker so PipelineChecklist can decode them.
  const outgoingStageNote = current.stageNote ?? null;
  const composedHistoryNote = [
    note,
    incomingStageNote ? encodeStageNote(newStage, incomingStageNote) : null,
    outgoingStageNote ? encodeStageNote(current.stage, outgoingStageNote) : null,
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

  // Phase 11.1: when stage moves backward, reset step statuses for any
  // step whose autoTrigger represents a stage now in the future. This
  // preserves the source-of-truth invariant (step.done ↔ stage has
  // been visited) when admin clicks a done stage-click step to revert.
  const curIdx = LEAD_STAGES.indexOf(current.stage);
  const newIdx = LEAD_STAGES.indexOf(newStage);
  if (newIdx < curIdx) {
    const futureStages = LEAD_STAGES.slice(newIdx + 1, curIdx + 1);
    const futureTriggers = futureStages
      .map((s) => STAGE_TO_STEP_TRIGGER[s])
      .filter((t): t is StepAutoTrigger => Boolean(t));
    if (futureTriggers.length) {
      const { data: stepsToReset } = await supabase
        .from("LeadStepDefinition")
        .select("id")
        .in("autoTrigger", futureTriggers);
      const stepIds = (stepsToReset ?? []).map((s) => s.id as string);
      if (stepIds.length) {
        await supabase
          .from("LeadStepStatus")
          .update({ status: "pending", completedAt: null, completedBy: null, updatedAt: now })
          .eq("leadId", id)
          .in("stepId", stepIds);
      }
    }
  }

  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: current.stage,
    toStage: newStage,
    changedBy: user.userId,
    note: composedHistoryNote,
    createdAt: now,
  });

  // Forward transitions auto-tick every stage-click step in
  // (curIdx, newIdx]. Bulk call keeps it a single round-trip even when
  // admin jumps multiple stages — preserves step.done ↔ stage-visited
  // invariant without N serial DB calls.
  if (newIdx > curIdx) {
    const fwdTriggers = LEAD_STAGES.slice(curIdx + 1, newIdx + 1)
      .map((s) => STAGE_TO_STEP_TRIGGER[s])
      .filter((t): t is StepAutoTrigger => Boolean(t));
    if (fwdTriggers.length) {
      await completeStepsByTriggers(id, fwdTriggers).catch(() => {});
    }
  }

  return NextResponse.json({ lead, changed: true });
}
