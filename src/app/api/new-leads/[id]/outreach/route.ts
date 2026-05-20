import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS, OUTREACH_LOG_COLUMNS } from "@/lib/db-columns";
import { renderLeadOutreach, sendLeadEmail } from "@/lib/email";
import type { Lead } from "@/lib/leads/types";

/**
 * Send one outreach email to a single lead. Admin-gated.
 *
 * Behavior:
 *   - 400 if lead.bucket is `unclassified` (no template) — admin must
 *     override bucket first.
 *   - 200 + OutreachLog row on success.
 *   - 502 + error message if Resend rejected (e.g. domain not verified).
 *
 * Side-effects (handled inside `sendLeadEmail`):
 *   - Writes OutreachLog (always, even on failure).
 *   - Auto-completes any step with `autoTrigger="email_sent"`.
 *   - Advances Lead.stage `new` → `outreach_sent` + writes history.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const { data: lead, error: lookupErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const typedLead = lead as unknown as Lead;
  const rendered = await renderLeadOutreach(typedLead);
  if (!rendered) {
    return NextResponse.json(
      { error: "Bucket belum di-classify — override bucket dulu sebelum kirim outreach." },
      { status: 400 },
    );
  }

  const result = await sendLeadEmail({
    to: typedLead.email,
    subject: rendered.subject,
    body: rendered.body,
    leadId: id,
    bucket: typedLead.bucket,
    templateUsed: rendered.templateUsed,
    currentStage: typedLead.stage,
    changedBy: user.userId,
  });

  // Fetch the just-written OutreachLog row to return its full shape
  // (lets the UI render the new row in the sent-history list).
  const { data: outreach } = await supabase
    .from("OutreachLog")
    .select(OUTREACH_LOG_COLUMNS)
    .eq("id", result.outreachId)
    .single();

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, outreach },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    outreach,
    stageAdvanced: result.stageAdvanced,
  });
}
