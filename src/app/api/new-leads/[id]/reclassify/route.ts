import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { classifyLead } from "@/lib/leads/bucketing";
import { newStageHistoryId } from "@/lib/leads/ids";
import { MENTORS } from "@/lib/mentors";

/**
 * Re-run classifyLead() on the lead's current targetCampusAndProgram and
 * write back the resulting bucket / parsed fields. Useful when:
 * - The CAMPUS_ALIASES list was updated
 * - Mentor list changed (new country covered, mentor offboarded)
 * - The lead text was edited and the operator wants a fresh classification
 *
 * Records the change in LeadStageHistory if the bucket actually shifted.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const { data: current, error: lookupErr } = await supabase
    .from("Lead")
    .select("bucket, stage, targetCampusAndProgram")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const result = classifyLead(
    current.targetCampusAndProgram,
    MENTORS.map((m) => ({ country: m.country ?? null })),
  );

  const now = new Date().toISOString();
  const bucketChanged = current.bucket !== result.bucket;
  // Phase 15: when re-classification shifts the bucket, clear the
  // review fields so admin re-verifies the new signal. (If the bucket
  // is unchanged, leave any existing review intact — nothing new to
  // look at.) We use a conditional spread instead of an explicit
  // branch so the .update() payload stays a single shape.
  const reviewReset = bucketChanged
    ? {
        classificationReviewedAt: null,
        classificationReviewedBy: null,
        classificationReviewNote: null,
      }
    : {};
  const { data: lead, error: updErr } = await supabase
    .from("Lead")
    .update({
      bucket: result.bucket,
      bucketReason: result.reason,
      parsedCountry: result.parsedCountry,
      parsedCampus: result.parsedCampus,
      parsedField: result.parsedField,
      isCampusPartner: result.isCampusPartner,
      hasCountryMentor: result.hasCountryMentor,
      partnerProgramScope: result.partnerProgramScope,
      ...reviewReset,
      updatedAt: now,
    })
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (bucketChanged) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId: id,
      fromStage: current.stage,
      toStage: current.stage,
      changedBy: user.userId,
      note: `Re-classified: ${current.bucket} → ${result.bucket}. ${result.reason}`,
      createdAt: now,
    });
  }

  return NextResponse.json({ lead, changed: bucketChanged });
}
