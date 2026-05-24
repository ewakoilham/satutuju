import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { newStageHistoryId } from "@/lib/leads/ids";

/**
 * Phase 15 — admin confirms (or re-confirms) that the lead's
 * auto-classification is correct. Sets the three review fields so the
 * lead becomes eligible for both auto-outreach cron and manual
 * outreach buttons.
 *
 * For BUCKET-OVERRIDE-as-review (admin says "wrong bucket, here's the
 * right one"), use PATCH /api/new-leads/[id]/bucket instead — that
 * route now sets the review fields atomically with the override.
 *
 * Body (all fields optional):
 *   { note?: string } — free-text snapshot of what was confirmed.
 *                       Defaults to "Klasifikasi dikonfirmasi tanpa
 *                       perubahan".
 *
 * Re-confirming an already-reviewed lead is a no-op success (idempotent).
 * We still update reviewedAt/By to the latest action — useful if a
 * lead was previously reviewed by a different admin and the current
 * admin wants to take fresh ownership.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;

  let note: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.note === "string") note = body.note.trim().slice(0, 500) || null;
  } catch {
    /* empty body OK */
  }

  // Look up current state so we can write a meaningful history entry
  // (and 404 cleanly if the lead doesn't exist).
  const { data: current, error: lookupErr } = await supabase
    .from("Lead")
    .select("stage, bucket, classificationReviewedAt")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const now = new Date().toISOString();
  const { data: lead, error: updErr } = await supabase
    .from("Lead")
    .update({
      classificationReviewedAt: now,
      classificationReviewedBy: user.userId,
      // Only overwrite note when the admin provided one; otherwise
      // preserve any previous note (e.g. from a prior override).
      ...(note ? { classificationReviewNote: note } : {}),
      updatedAt: now,
    })
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // History entry only on the FIRST review — re-confirms are admin
  // bookkeeping, not lead lifecycle events worth noting.
  if (!current.classificationReviewedAt) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId: id,
      fromStage: current.stage,
      toStage: current.stage,
      changedBy: user.userId,
      note: note
        ? `Klasifikasi dikonfirmasi (bucket ${current.bucket}). ${note}`
        : `Klasifikasi dikonfirmasi tanpa perubahan (bucket ${current.bucket})`,
      createdAt: now,
    });
  }

  return NextResponse.json({ lead, reReview: !!current.classificationReviewedAt });
}
