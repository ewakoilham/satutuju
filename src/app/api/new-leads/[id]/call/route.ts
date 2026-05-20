import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_DECISIONS, type LeadDecision } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";

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

  // Optional: advance stage to call_completed
  let stageAdvanced = false;
  if (body.markCompleted === true) {
    if (lead.stage === "call_scheduled" || lead.stage === "call_completed") {
      update.stage = "call_completed";
      update.callCompletedAt = new Date().toISOString();
      stageAdvanced = lead.stage !== "call_completed";
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

  if (stageAdvanced) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId: id,
      fromStage: lead.stage,
      toStage: "call_completed",
      changedBy: user.userId,
      note: `Call completed${update.decision ? ` · decision: ${update.decision}` : ""}${update.readinessScore !== undefined ? ` · readiness: ${update.readinessScore}/5` : ""}`,
      createdAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ lead: updated, stageAdvanced });
}
