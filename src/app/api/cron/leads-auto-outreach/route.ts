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
 *   - **Phase 15:** leads with `classificationReviewedAt = null`
 *     (admin hasn't confirmed classification yet — hard gate)
 *
 * Sequential send with 250ms pacing — same as bulk-outreach. Caps at
 * 50 sends per run to keep cron execution under Vercel's timeout.
 */

const MAX_PER_RUN = 50;

export async function GET(req: NextRequest) {
  // Fail closed: this endpoint sends real outreach emails. If CRON_SECRET
  // is unset we must refuse, not run unauthenticated (which would let
  // anyone trigger sends and burn the email quota).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[leads-auto-outreach] CRON_SECRET not set");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
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
  // a template, classification reviewed by admin (Phase 15), and
  // created at least delayMinutes ago.
  //
  // We DON'T add `.not("classificationReviewedAt", "is", null)` to the
  // query itself — instead we partition in JS so we can report how many
  // candidates were held back by the review gate vs. dropped for other
  // reasons. That visibility matters for the auto-send settings UI: if
  // 12 leads sit in the queue the admin wants to know they're waiting
  // on a human, not a bug.
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

  const withTemplate = ((leads ?? []) as unknown as Lead[]).filter(
    (l) => templateBucketFor(l.bucket) !== null,
  );
  const unreviewedSkipped = withTemplate.filter((l) => !l.classificationReviewedAt).length;
  const eligible = withTemplate.filter((l) => !!l.classificationReviewedAt);

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
    unreviewedSkipped,
    delayMinutes,
    results,
  });
}
