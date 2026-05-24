import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Aggregate stats for the summary cards at the top of the leads
 * dashboard. Runs four parallel COUNT queries — cheap on Postgres.
 *
 * Response shape:
 * {
 *   total: number,
 *   bucketCounts: { A: 42, B: 12, ... },
 *   stageCounts: { new: 10, outreach_sent: 5, ... },
 *   funnel: { sent: 50, delivered: 48, opened: 30, clicked: 12,
 *             callScheduled: 8, callCompleted: 6, matched: 4 }
 * }
 */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  // Pull just the columns we need across ALL leads. 148 rows × ~50 bytes
  // = ~7KB, cheap to scan in one round-trip rather than 7 separate
  // count(*) queries.
  const { data, error } = await supabase
    .from("Lead")
    .select("bucket, stage, outreachSentAt, emailOpenedAt, emailClickedAt, callScheduledAt, callCompletedAt, mentorMatchedId, classificationReviewedAt");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type LeadStats = {
    bucket: string;
    stage: string;
    outreachSentAt: string | null;
    emailOpenedAt: string | null;
    emailClickedAt: string | null;
    callScheduledAt: string | null;
    callCompletedAt: string | null;
    mentorMatchedId: string | null;
    classificationReviewedAt: string | null;
  };

  const rows = (data ?? []) as LeadStats[];
  const total = rows.length;

  const bucketCounts: Record<string, number> = {};
  const stageCounts: Record<string, number> = {};
  // Bucket × stage crosstab — lets the client recompute sidebar segment
  // counts when a bucket filter is active (so the sidebar number always
  // matches the visible list). Keyed: bucketStageCounts[bucket][stage].
  const bucketStageCounts: Record<string, Record<string, number>> = {};
  let sent = 0, opened = 0, clicked = 0, callScheduled = 0, callCompleted = 0, matched = 0;
  // Phase 15: how many leads still need admin review of their auto-
  // classification. Drives the new "Butuh review klasifikasi" segment
  // count + the nav badge.
  let unreviewedCount = 0;

  for (const r of rows) {
    bucketCounts[r.bucket] = (bucketCounts[r.bucket] ?? 0) + 1;
    stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1;
    const byStage = bucketStageCounts[r.bucket] ?? (bucketStageCounts[r.bucket] = {});
    byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    if (r.outreachSentAt) sent++;
    if (r.emailOpenedAt) opened++;
    if (r.emailClickedAt) clicked++;
    if (r.callScheduledAt) callScheduled++;
    if (r.callCompletedAt) callCompleted++;
    if (r.mentorMatchedId) matched++;
    if (!r.classificationReviewedAt) unreviewedCount++;
  }

  return NextResponse.json({
    total,
    bucketCounts,
    stageCounts,
    bucketStageCounts,
    unreviewedCount,
    funnel: {
      total,
      sent,
      opened,
      clicked,
      callScheduled,
      callCompleted,
      matched,
    },
  });
}
