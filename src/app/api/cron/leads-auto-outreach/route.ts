import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { renderLeadOutreach, sendLeadEmail } from "@/lib/email";
import { templateBucketFor, type Lead } from "@/lib/leads/types";

const DELAY_MS = 250;

/**
 * Vercel cron — auto-send outreach to newly-classified leads after the
 * configured delay. Reads LeadAutoSendSetting singleton. Skips:
 *   - when `enabled = false` (admin paused)
 *   - leads with bucket `unclassified` (no template)
 *   - leads with `outreachSentAt != null` (already sent)
 *   - leads with `stage != "new"` (already moved past)
 *   - leads created less than `delayMinutes` ago (still in cooldown)
 *
 * Sequential send with 250ms pacing — same as bulk-outreach. Caps at
 * 50 sends per run to keep cron execution under Vercel's timeout.
 */

const MAX_PER_RUN = 50;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load settings
  const { data: setting } = await supabase
    .from("LeadAutoSendSetting")
    .select("enabled, delayMinutes")
    .eq("id", "singleton")
    .single();
  if (!setting || setting.enabled !== true) {
    return NextResponse.json({ ok: true, skipped: true, reason: "auto-send disabled" });
  }
  const delayMinutes = Number(setting.delayMinutes) || 60;

  // Find qualifying leads: stage=new, outreachSentAt null, bucket has
  // a template, and created at least delayMinutes ago.
  const cutoffIso = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();
  const { data: leads, error: loadErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .eq("stage", "new")
    .is("outreachSentAt", null)
    .lte("createdAt", cutoffIso)
    .order("createdAt", { ascending: true })
    .limit(MAX_PER_RUN);
  if (loadErr) {
    return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  }

  const eligible = ((leads ?? []) as unknown as Lead[]).filter(
    (l) => templateBucketFor(l.bucket) !== null,
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const results: Array<{ leadId: string; bucket: string; status: string; error?: string }> = [];

  for (let i = 0; i < eligible.length; i++) {
    const lead = eligible[i];
    const rendered = await renderLeadOutreach(lead);
    if (!rendered) {
      skipped++;
      results.push({ leadId: lead.id, bucket: lead.bucket, status: "skipped" });
      continue;
    }
    const r = await sendLeadEmail({
      to: lead.email,
      subject: rendered.subject,
      body: rendered.body,
      leadId: lead.id,
      bucket: lead.bucket,
      templateUsed: rendered.templateUsed,
      currentStage: lead.stage,
      changedBy: "cron",
    });
    if (r.ok) {
      sent++;
      results.push({ leadId: lead.id, bucket: lead.bucket, status: "sent" });
    } else {
      failed++;
      results.push({ leadId: lead.id, bucket: lead.bucket, status: "failed", error: r.error });
    }
    if (i < eligible.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Write lastRunAt + a one-line summary as note via updatedBy (just to
  // surface in the settings UI).
  await supabase
    .from("LeadAutoSendSetting")
    .update({
      lastRunAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", "singleton");

  return NextResponse.json({
    ok: true,
    eligible: eligible.length,
    sent,
    failed,
    skipped,
    delayMinutes,
    results,
  });
}
