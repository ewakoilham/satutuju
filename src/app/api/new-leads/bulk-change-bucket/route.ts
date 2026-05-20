import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_BUCKETS, type LeadBucket } from "@/lib/leads/types";

const MAX_BULK = 200;

function historyId(): string {
  return "lsh_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

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

  let changed = 0;
  const skipped: string[] = [];
  for (const lead of (leads ?? []) as Array<{ id: string; bucket: string; stage: string }>) {
    if (lead.bucket === targetBucket) {
      skipped.push(lead.id);
      continue;
    }
    await supabase
      .from("Lead")
      .update({
        bucket: targetBucket,
        bucketReason: `Manual bulk override → ${targetBucket}: ${reason}`,
        updatedAt: now,
      })
      .eq("id", lead.id);

    await supabase.from("LeadStageHistory").insert({
      id: historyId(),
      leadId: lead.id,
      fromStage: lead.stage,
      toStage: lead.stage,
      changedBy: user.userId,
      note: `Manual bulk bucket override: ${lead.bucket} → ${targetBucket}. ${reason}`,
      createdAt: now,
    });
    changed++;
  }

  return NextResponse.json({
    total: leadIds.length,
    changed,
    skipped: skipped.length,
    skippedIds: skipped,
  });
}
