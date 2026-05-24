import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMentor } from "@/lib/leads/auth-guards";
import { newMentorLeadViewId } from "@/lib/leads/ids";

/**
 * Phase 16: mark a lead as "viewed by this mentor right now".
 *
 * Called once when the mentor opens the lead detail slide-over.
 * Upserts MentorLeadView (mentorId, leadId) with lastViewedAt=NOW().
 * Subsequent reads of /api/mentor/leads compare admin-reply createdAt
 * against this timestamp to compute hasUnreadAdminReply.
 *
 * Idempotent: re-POSTing during the same session is fine — it just
 * pushes lastViewedAt forward. We don't enforce a debounce because the
 * caller (page.tsx) only fires this on detail panel mount, not on
 * every render.
 *
 * Body: empty (no fields needed; mentorId comes from auth, leadId
 * from URL).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;

  const { id: leadId } = await params;

  // 404 the lead first so a typo / deleted lead doesn't silently
  // create orphan view rows. Cheap — Lead is indexed on id.
  const { data: lead, error: lookupErr } = await supabase
    .from("Lead")
    .select("id")
    .eq("id", leadId)
    .maybeSingle();
  if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const now = new Date().toISOString();

  // Try update first. If 0 rows affected, insert. Cheaper than upsert
  // since Supabase's onConflict-on-compound-unique requires the unique
  // index name and is finicky; this two-step is foolproof.
  const { data: updated, error: updErr } = await supabase
    .from("MentorLeadView")
    .update({ lastViewedAt: now })
    .eq("mentorId", mentor.userId)
    .eq("leadId", leadId)
    .select("id")
    .maybeSingle();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (!updated) {
    const { error: insErr } = await supabase.from("MentorLeadView").insert({
      id: newMentorLeadViewId(),
      mentorId: mentor.userId,
      leadId,
      lastViewedAt: now,
      createdAt: now,
    });
    // Race: another tab inserted between our update and insert. The
    // unique constraint catches it; treat as success.
    if (insErr && insErr.code !== "23505") {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, lastViewedAt: now });
}
