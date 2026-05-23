import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMentor } from "@/lib/leads/auth-guards";
import { notifyAllAdmins } from "@/lib/leads/notification-helpers";

/**
 * POST /api/mentor/leads/[id]/flag — toggle on. Optional `context`
 * body field stores the mentor's one-liner ("Pernah mentee gw tahun
 * lalu"). Idempotent: re-POST on an already-flagged lead just updates
 * the context.
 *
 * DELETE — toggle off. 204 even if there was no flag (idempotent).
 *
 * Fires `lead_flagged_by_mentor` notification to all admins on POST.
 */

function flagId(): string {
  return "mlf_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;

  const { id: leadId } = await params;
  let body: { context?: unknown } = {};
  try { body = await req.json(); } catch { /* empty body is OK */ }
  const context = typeof body.context === "string"
    ? body.context.trim().slice(0, 500) || null
    : null;

  // Sanity-check the lead exists (avoids dangling FK rows on bad input).
  const { data: lead, error: leadErr } = await supabase
    .from("Lead")
    .select("id, name")
    .eq("id", leadId)
    .single();
  if (leadErr) {
    const code = leadErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: leadErr.message }, { status: code });
  }

  // Upsert via select-then-insert/update — avoids needing a unique
  // constraint name. Race-safe under Postgres unique (leadId,mentorId).
  const { data: existing } = await supabase
    .from("MentorLeadFlag")
    .select("id")
    .eq("leadId", leadId)
    .eq("mentorId", mentor.userId)
    .maybeSingle();

  let wasNew = false;
  if (existing) {
    await supabase.from("MentorLeadFlag").update({ context }).eq("id", existing.id);
  } else {
    const { error: insertErr } = await supabase.from("MentorLeadFlag").insert({
      id: flagId(),
      leadId,
      mentorId: mentor.userId,
      context,
      createdAt: new Date().toISOString(),
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    wasNew = true;
  }

  // Notify admins only on first flag (not on context-update re-POSTs).
  if (wasNew) {
    void notifyAllAdmins({
      title: "Lead ditandai oleh mentor",
      message: `${mentor.name} menandai mengenal lead ${lead.name}${context ? ` · "${context}"` : ""}`,
      type: "lead_flagged_by_mentor",
      link: `/dashboard/admin/new-leads/${leadId}`,
    });
  }

  return NextResponse.json({ flagged: true, context });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;
  const { id: leadId } = await params;

  await supabase
    .from("MentorLeadFlag")
    .delete()
    .eq("leadId", leadId)
    .eq("mentorId", mentor.userId);

  return NextResponse.json({ flagged: false });
}
