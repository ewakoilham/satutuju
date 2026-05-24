import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Phase 15 — bulk-confirm classification review for a batch of leads.
 * Used by the inbox bulk-action bar when the admin wants to sweep
 * through a list of obviously-correct classifications in one shot.
 *
 * Body: { leadIds: string[] }
 *
 * Behaviour:
 *   - Already-reviewed leads in the batch are no-ops (skipped count).
 *   - Doesn't write LeadStageHistory rows (one per lead in a bulk
 *     sweep would flood the history table — single-lead /review keeps
 *     that audit trail; bulk is treated as a triage gesture).
 *   - No override option here. If admin needs to change bucket, they
 *     open the lead and use PATCH /[id]/bucket on a per-lead basis.
 */
const MAX_BULK = 200;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { leadIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds must be a non-empty array" }, { status: 400 });
  }
  if (body.leadIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BULK} leads per request (got ${body.leadIds.length})` },
      { status: 400 },
    );
  }
  const leadIds = body.leadIds.filter((x): x is string => typeof x === "string");

  // Single UPDATE for everyone — much cheaper than N round-trips.
  // We scope to `classificationReviewedAt IS NULL` so re-confirming an
  // already-reviewed lead in the batch is genuinely a no-op (and we can
  // distinguish "newly reviewed" from "already reviewed" via row count).
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("Lead")
    .update({
      classificationReviewedAt: now,
      classificationReviewedBy: user.userId,
      updatedAt: now,
    })
    .in("id", leadIds)
    .is("classificationReviewedAt", null)
    .select("id");
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const reviewed = (updated ?? []).length;
  const skippedAlready = leadIds.length - reviewed;

  return NextResponse.json({
    ok: true,
    total: leadIds.length,
    reviewed,
    skippedAlready,
  });
}
