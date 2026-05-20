import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { LEAD_BUCKETS } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";

/**
 * Manual bucket override. Required justification text — auditors need to
 * know why the auto-classifier was overridden. Writes a LeadStageHistory
 * row tagged as a bucket-override note (the from/to fields capture
 * the lead's current stage, not the bucket — bucket change itself is on
 * the Lead row).
 *
 * Body: { bucket: LeadBucket, reason: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: { bucket?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.bucket !== "string" || !(LEAD_BUCKETS as readonly string[]).includes(body.bucket)) {
    return NextResponse.json({ error: "bucket must be one of " + LEAD_BUCKETS.join("|") }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "reason is required for manual bucket override" }, { status: 400 });
  }

  const newBucket = body.bucket as (typeof LEAD_BUCKETS)[number];

  const { data: current, error: lookupErr } = await supabase
    .from("Lead")
    .select("bucket, stage")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const now = new Date().toISOString();
  const newReason = `[manual override by ${user.userId}] ${reason.slice(0, 500)}`;
  const { data: lead, error: updErr } = await supabase
    .from("Lead")
    .update({
      bucket: newBucket,
      bucketReason: newReason,
      updatedAt: now,
    })
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: current.stage,
    toStage: current.stage,
    changedBy: user.userId,
    note: `Bucket override: ${current.bucket} → ${newBucket}. ${reason.slice(0, 400)}`,
    createdAt: now,
  });

  return NextResponse.json({ lead });
}
