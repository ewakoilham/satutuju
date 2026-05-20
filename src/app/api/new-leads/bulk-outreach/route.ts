import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { renderLeadOutreach, sendLeadEmail } from "@/lib/email";
import type { Lead } from "@/lib/leads/types";

const MAX_BULK = 100;
// 250ms between sends → ≤ 4 req/s, well below Resend's 10 req/s limit
// with room for parallel reads to share the connection budget.
const DELAY_MS = 250;

interface BulkResultRow {
  leadId: string;
  status: "sent" | "failed" | "skipped";
  bucket?: string;
  templateUsed?: string;
  resendMessageId?: string | null;
  reason?: string;
  error?: string;
}

/**
 * Bulk outreach dispatch. Sequential with a small delay per send to
 * stay well under Resend's rate limit. Skips leads in `unclassified`
 * (no template) so the caller doesn't have to pre-filter.
 *
 * Body: { leadIds: string[] }
 * Response: { total, sent, failed, skipped, results: BulkResultRow[] }
 *
 * NOTE: this loops in a single request, which can take ~3s for 10 leads
 * and ~25s for 100. Vercel's default timeout (60s) accommodates that.
 * For larger batches, switch to a background queue (Phase 4+).
 */
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

  // Load all leads in one query so we can render templates per-lead
  // without N round-trips.
  const { data: leads, error: loadErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .in("id", leadIds);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  // Index by id so we can preserve the caller's order in the results.
  const byId = new Map<string, Lead>();
  for (const l of (leads ?? []) as unknown as Lead[]) byId.set(l.id, l);

  const results: BulkResultRow[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < leadIds.length; i++) {
    const id = leadIds[i];
    const lead = byId.get(id);
    if (!lead) {
      results.push({ leadId: id, status: "skipped", reason: "lead not found" });
      skipped++;
      continue;
    }

    const rendered = await renderLeadOutreach(lead);
    if (!rendered) {
      results.push({
        leadId: id,
        bucket: lead.bucket,
        status: "skipped",
        reason: `no template for bucket ${lead.bucket}`,
      });
      skipped++;
      continue;
    }

    const r = await sendLeadEmail({
      to: lead.email,
      subject: rendered.subject,
      body: rendered.body,
      leadId: id,
      bucket: lead.bucket,
      templateUsed: rendered.templateUsed,
      currentStage: lead.stage,
      changedBy: user.userId,
    });
    if (r.ok) {
      sent++;
      results.push({
        leadId: id,
        bucket: lead.bucket,
        templateUsed: rendered.templateUsed,
        resendMessageId: r.resendMessageId,
        status: "sent",
      });
    } else {
      failed++;
      results.push({
        leadId: id,
        bucket: lead.bucket,
        templateUsed: rendered.templateUsed,
        status: "failed",
        error: r.error,
      });
    }

    // Pace the loop so we don't trip Resend's rate limit. Skip on the
    // last iteration to avoid pointless latency.
    if (i < leadIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return NextResponse.json({
    total: leadIds.length,
    sent,
    failed,
    skipped,
    results,
  });
}
