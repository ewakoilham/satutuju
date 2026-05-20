import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_BUCKETS, type LeadBucket } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";

const MAX_BULK = 200;

/**
 * Bulk move-bucket — manually move many leads to a different bucket
 * with a required justification (recorded in LeadStageHistory). Useful
 * when admin spots a systematic misclassification (e.g. "all these
 * Hungary leads should be bucket B because we just onboarded a Hungary
 * mentor — fix retroactively").
 *
 * Body: { leadIds: string[]; bucket: LeadBucket; reason: string }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { leadIds?: unknown; bucket?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }
  if (body.leadIds.length > MAX_BULK) {
    return NextResponse.json({ error: `Max ${MAX_BULK} leads per request` }, { status: 400 });
  }
  if (typeof body.bucket !== "string" || !(LEAD_BUCKETS as readonly string[]).includes(body.bucket)) {
    return NextResponse.json({ error: `bucket must be one of ${LEAD_BUCKETS.join("|")}` }, { status: 400 });
  }
  if (typeof body.reason !== "string" || !body.reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }
  const leadIds = body.leadIds.filter((x): x is string => typeof x === "string");
  const targetBucket = body.bucket as LeadBucket;
  const reason = body.reason.trim().slice(0, 500);
  const now = new Date().toISOString();

  // Load current buckets so we can write accurate history rows + skip
  // no-op moves (lead already in target bucket).
  const { data: leads } = await supabase
    .from("Lead")
    .select("id, bucket, stage")
    .in("id", leadIds);

  type LeadRow = { id: string; bucket: string; stage: string };
  const all = (leads ?? []) as LeadRow[];
  const changedLeads = all.filter((l) => l.bucket !== targetBucket);
  const skippedIds = all.filter((l) => l.bucket === targetBucket).map((l) => l.id);

  if (changedLeads.length === 0) {
    return NextResponse.json({ total: leadIds.length, changed: 0, skipped: skippedIds.length, skippedIds });
  }

  // Single UPDATE for all rows + single INSERT for all history entries
  // — drops 2N round-trips to 2.
  const { error: updErr } = await supabase
    .from("Lead")
    .update({
      bucket: targetBucket,
      bucketReason: `Manual bulk override → ${targetBucket}: ${reason}`,
      updatedAt: now,
    })
    .in("id", changedLeads.map((l) => l.id));
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("LeadStageHistory").insert(
    changedLeads.map((lead) => ({
      id: newStageHistoryId(),
      leadId: lead.id,
      fromStage: lead.stage,
      toStage: lead.stage,
      changedBy: user.userId,
      note: `Manual bulk bucket override: ${lead.bucket} → ${targetBucket}. ${reason}`,
      createdAt: now,
    })),
  );

  return NextResponse.json({
    total: leadIds.length,
    changed: changedLeads.length,
    skipped: skippedIds.length,
    skippedIds,
  });
}
