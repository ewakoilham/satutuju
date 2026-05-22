import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_DECISIONS, type LeadDecision, type LeadStage, type StepAutoTrigger } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";

/**
 * When admin marks the call completed, the lead's next stage is driven
 * by the decision they recorded:
 *
 *   proceed             → deposit_pending  (invoice sent, 1×24h wait)
 *   agree_to_pay        → deposit_agreed   (mentee commit langsung — skip wait)
 *   waitlist            → waitlist         (hold, follow-up 1 week)
 *   declined_by_student → declined         (lead withdrew)
 *   rejected_by_us      → rejected         (we declined; archive)
 *   (no decision)       → call_completed   (legacy fallback)
 *
 * Auto-fires the matching pipeline step via STAGE_TO_STEP_TRIGGER so
 * the checklist stays in sync without manual ticks.
 */
function nextStageForDecision(decision: LeadDecision | null | undefined): LeadStage {
  switch (decision) {
    case "proceed":             return "deposit_pending";
    case "agree_to_pay":        return "deposit_agreed";
    case "waitlist":            return "waitlist";
    case "declined_by_student": return "declined";
    case "rejected_by_us":      return "rejected";
    default:                    return "call_completed";
  }
}
const STAGE_TO_STEP_TRIGGER: Partial<Record<LeadStage, StepAutoTrigger>> = {
  deposit_pending: "deposit_pending",
  deposit_agreed:  "deposit_agreed",
};

/**
 * Persist call panel data + (optionally) advance stage to call_completed.
 *
 * Body: {
 *   readinessScore?: number 0-5,
 *   callNotes?: string,
 *   redFlags?: string,
 *   decision?: LeadDecision | null,
 *   depositTier?: 1 | 2 | 3 | null,
 *   assignedInterviewer?: string | null,
 *   markCompleted?: boolean,   // when true, also advance stage
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data: lead, error: lookupErr } = await supabase
    .from("Lead")
    .select("stage, readinessScore, callNotes, redFlags, decision, depositTier, assignedInterviewer")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.readinessScore !== undefined) {
    const n = Number(body.readinessScore);
    if (!Number.isInteger(n) || n < 0 || n > 5) {
      return NextResponse.json({ error: "readinessScore must be 0-5" }, { status: 400 });
    }
    update.readinessScore = n;
  }
  if (typeof body.callNotes === "string") update.callNotes = body.callNotes.slice(0, 5000);
  if (body.callNotes === null) update.callNotes = null;
  if (typeof body.redFlags === "string") update.redFlags = body.redFlags.slice(0, 2000);
  if (body.redFlags === null) update.redFlags = null;
  if (body.decision !== undefined) {
    if (body.decision === null) {
      update.decision = null;
    } else if (typeof body.decision === "string" && (LEAD_DECISIONS as readonly string[]).includes(body.decision)) {
      update.decision = body.decision as LeadDecision;
    } else {
      return NextResponse.json({ error: `decision must be one of ${LEAD_DECISIONS.join("|")} or null` }, { status: 400 });
    }
  }
  if (body.depositTier !== undefined) {
    if (body.depositTier === null) {
      update.depositTier = null;
    } else {
      const t = Number(body.depositTier);
      if (![1, 2, 3].includes(t)) {
        return NextResponse.json({ error: "depositTier must be 1, 2, 3, or null" }, { status: 400 });
      }
      update.depositTier = t;
    }
  }
  if (body.assignedInterviewer !== undefined) {
    if (body.assignedInterviewer === null) {
      update.assignedInterviewer = null;
    } else if (typeof body.assignedInterviewer === "string") {
      update.assignedInterviewer = body.assignedInterviewer.trim().slice(0, 50) || null;
    }
  }

  // Optional: advance stage based on decision when admin marks call completed.
  let stageAdvanced = false;
  let nextStage: LeadStage | null = null;
  if (body.markCompleted === true) {
    if (lead.stage === "call_scheduled" || lead.stage === "call_completed") {
      // Use the resolved decision (from this PATCH or the existing one
      // on the lead) to pick the next stage.
      const resolvedDecision = (update.decision as LeadDecision | null | undefined)
        ?? (lead.decision as LeadDecision | null | undefined);
      nextStage = nextStageForDecision(resolvedDecision);
      update.stage = nextStage;
      update.callCompletedAt = new Date().toISOString();
      stageAdvanced = lead.stage !== nextStage;
    } else {
      return NextResponse.json(
        { error: `Cannot mark completed: current stage is "${lead.stage}", expected "call_scheduled"` },
        { status: 400 },
      );
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from("Lead")
    .update(update)
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (stageAdvanced && nextStage) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId: id,
      fromStage: lead.stage,
      toStage: nextStage,
      changedBy: user.userId,
      note: `Call completed${update.decision ? ` · decision: ${update.decision}` : ""}${update.readinessScore !== undefined ? ` · readiness: ${update.readinessScore}/5` : ""}`,
      createdAt: new Date().toISOString(),
    });

    // Fire downstream pipeline step trigger for the new stage (e.g.
    // moving to deposit_pending checks the "Menunggu Konfirmasi Deposit"
    // step). No-op for stages without a listening step.
    const stepTrigger = STAGE_TO_STEP_TRIGGER[nextStage];
    if (stepTrigger) {
      await completeStepByTrigger(id, stepTrigger).catch(() => {});
    }
  }

  return NextResponse.json({ lead: updated, stageAdvanced, nextStage });
}
