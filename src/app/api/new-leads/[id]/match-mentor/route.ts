import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";

/**
 * Match a lead to a mentor. Writes Lead.mentorMatchedId + advances
 * stage to `matched`. Idempotent — re-matching to the same mentor is
 * a no-op; matching to a different mentor updates the FK + writes
 * a fresh history row.
 *
 * Body: { mentorId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: { mentorId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.mentorId !== "string" || !body.mentorId.trim()) {
    return NextResponse.json({ error: "mentorId is required" }, { status: 400 });
  }
  const mentorId = body.mentorId.trim();

  const { data: lead, error: lookupErr } = await supabase
    .from("Lead")
    .select("stage, mentorMatchedId")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const now = new Date().toISOString();
  const wasMatched = lead.stage === "matched";
  const sameMentor = lead.mentorMatchedId === mentorId;

  const { data: updated, error: updErr } = await supabase
    .from("Lead")
    .update({
      mentorMatchedId: mentorId,
      stage: "matched",
      updatedAt: now,
    })
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (!sameMentor || !wasMatched) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId: id,
      fromStage: lead.stage,
      toStage: "matched",
      changedBy: user.userId,
      note: wasMatched
        ? `Re-matched: ${lead.mentorMatchedId} → ${mentorId}`
        : `Matched with mentor ${mentorId}`,
      createdAt: now,
    });
  }

  // Auto-complete any pipeline step listening for the `matched` trigger
  // (default seed: "Match dengan mentor"). Safe to call repeatedly —
  // completeStepByTrigger only flips pending rows.
  await completeStepByTrigger(id, "matched").catch(() => {});

  return NextResponse.json({ lead: updated, mentorId });
}
