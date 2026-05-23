import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import {
  LEAD_STAGES,
  STAGE_TO_STEP_TRIGGER,
  encodeStageNote,
  isTerminalOffRamp,
  type LeadStage,
  type StepAutoTrigger,
} from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepsByTriggers } from "@/lib/leads/step-helpers";

/** All stage-click triggers — the linear-funnel steps that can be
 *  reset when entering a terminal off-ramp or re-synced when leaving
 *  one. Derived from STAGE_TO_STEP_TRIGGER at module load. */
const ALL_STAGE_CLICK_TRIGGERS: readonly StepAutoTrigger[] = Object.values(
  STAGE_TO_STEP_TRIGGER,
).filter((t): t is StepAutoTrigger => Boolean(t));

/** Reset stage-click LeadStepStatus rows to pending. Used by both the
 *  backward-revert path (subset of triggers) and the to-terminal path
 *  (all stage-click triggers). One lookup + one bulk update. */
async function resetStepStatusesByTriggers(
  leadId: string,
  triggers: readonly StepAutoTrigger[],
  now: string,
): Promise<void> {
  if (triggers.length === 0) return;
  const { data: steps } = await supabase
    .from("LeadStepDefinition")
    .select("id")
    .in("autoTrigger", triggers as unknown as string[]);
  const stepIds = (steps ?? []).map((s) => s.id as string);
  if (stepIds.length === 0) return;
  await supabase
    .from("LeadStepStatus")
    .update({ status: "pending", completedAt: null, completedBy: null, updatedAt: now })
    .eq("leadId", leadId)
    .in("stepId", stepIds);
}

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

  // Phase 11.3: branch on terminal-off-ramp involvement.
  //   1. toTerminal  → reset ALL stage-click steps to pending; don't
  //                    fan-out (lead didn't actually visit them).
  //   2. fromTerminal → re-sync: tick every stage-click step whose
  //                    represented stage idx ≤ newIdx; reset the rest.
  //   3. linear ↔ linear → existing Phase 11.1/11.2 backward-reset +
  //                    forward-fan-out around the [from, to] window.
  const curIdx = LEAD_STAGES.indexOf(current.stage);
  const newIdx = LEAD_STAGES.indexOf(newStage);
  const toTerminal = isTerminalOffRamp(newStage);
  const fromTerminal = isTerminalOffRamp(current.stage);

  if (toTerminal) {
    await resetStepStatusesByTriggers(id, ALL_STAGE_CLICK_TRIGGERS, now);
  } else if (fromTerminal) {
    // Re-sync step statuses against the new linear position. Tick the
    // stage-click steps whose represented stage idx ≤ newIdx; reset
    // the rest (defensive — they may be stale from the previous
    // pre-terminal life of this lead).
    const ticked: StepAutoTrigger[] = [];
    const reset: StepAutoTrigger[] = [];
    for (const trigger of ALL_STAGE_CLICK_TRIGGERS) {
      // Find the stage that owns this trigger in STAGE_TO_STEP_TRIGGER.
      const ownerStage = (Object.entries(STAGE_TO_STEP_TRIGGER) as [LeadStage, StepAutoTrigger | undefined][])
        .find(([, t]) => t === trigger)?.[0];
      if (!ownerStage) continue;
      const stageIdx = LEAD_STAGES.indexOf(ownerStage);
      if (stageIdx <= newIdx) ticked.push(trigger);
      else reset.push(trigger);
    }
    await resetStepStatusesByTriggers(id, reset, now);
    if (ticked.length) await completeStepsByTriggers(id, ticked).catch(() => {});
  } else if (newIdx < curIdx) {
    // Linear backward: reset stage-click triggers for stages now in
    // the future (the existing Phase 11.1 invariant).
    const futureTriggers = LEAD_STAGES.slice(newIdx + 1, curIdx + 1)
      .map((s) => STAGE_TO_STEP_TRIGGER[s])
      .filter((t): t is StepAutoTrigger => Boolean(t));
    await resetStepStatusesByTriggers(id, futureTriggers, now);
  }
  // (Linear forward case handled below the history insert.)

  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: current.stage,
    toStage: newStage,
    changedBy: user.userId,
    note: composedHistoryNote,
    createdAt: now,
  });

  // Linear forward fan-out: auto-tick every stage-click step in
  // (curIdx, newIdx]. Skipped when target is terminal (handled above)
  // or when source is terminal (re-sync already covered everything).
  if (!toTerminal && !fromTerminal && newIdx > curIdx) {
    const fwdTriggers = LEAD_STAGES.slice(curIdx + 1, newIdx + 1)
      .map((s) => STAGE_TO_STEP_TRIGGER[s])
      .filter((t): t is StepAutoTrigger => Boolean(t));
    if (fwdTriggers.length) {
      await completeStepsByTriggers(id, fwdTriggers).catch(() => {});
    }
  }

  return NextResponse.json({ lead, changed: true });
}
