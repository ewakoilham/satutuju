import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { reachoutLead, type ChannelOutcome } from "@/lib/leads/reachout";
import { OUTREACH_CHANNELS, type Lead, type OutreachChannel } from "@/lib/leads/types";

const MAX_BULK = 100;
// 250ms between LEADS (not channels). Resend rate limit (10 req/s) is
// the tightest; Fonnte's quota is generous. With both channels enabled
// per lead, this keeps us at ~4 leads/s = 8 sends/s, still under Resend.
const DELAY_MS = 250;

interface BulkResultRow {
  leadId: string;
  bucket: string;
  outcomes: ChannelOutcome[];
}

/**
 * Bulk reachout dispatch. Sequential per-lead (with delay) so Resend's
 * 10 req/s rate limit isn't tripped. Within each lead, channels are
 * sequential (see reachoutLead docs for why).
 *
 * Body: { leadIds: string[], channels?: ("email"|"whatsapp")[] }
 *   - channels defaults to ["email"] (backward compat)
 *
 * Response: {
 *   total: number,                     // leads attempted
 *   leadsSent: number,                 // ≥1 channel succeeded
 *   leadsAllFailed: number,            // all requested channels failed
 *   leadsAllSkipped: number,           // all requested channels skipped
 *   channelsSent: number,              // total send successes across all leads
 *   channelsFailed: number,
 *   channelsSkipped: number,
 *   results: BulkResultRow[]
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { leadIds?: unknown; channels?: unknown };
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

  // Channels default + validation
  let channels: OutreachChannel[] = ["email"];
  if (Array.isArray(body.channels)) {
    const validated = body.channels.filter(
      (c: unknown): c is OutreachChannel =>
        typeof c === "string" && (OUTREACH_CHANNELS as readonly string[]).includes(c),
    );
    if (validated.length > 0) channels = validated;
  }

  const { data: leads, error: loadErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .in("id", leadIds);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const byId = new Map<string, Lead>();
  for (const l of (leads ?? []) as unknown as Lead[]) byId.set(l.id, l);

  const results: BulkResultRow[] = [];
  let leadsSent = 0;
  let leadsAllFailed = 0;
  let leadsAllSkipped = 0;
  let channelsSent = 0;
  let channelsFailed = 0;
  let channelsSkipped = 0;

  for (let i = 0; i < leadIds.length; i++) {
    const id = leadIds[i];
    const lead = byId.get(id);
    if (!lead) {
      // Lead not found is a "skipped" lead — record it via a synthetic
      // outcomes array so the response shape stays uniform.
      results.push({
        leadId: id,
        bucket: "unknown",
        outcomes: channels.map((ch) => ({
          channel: ch,
          status: "skipped" as const,
          reason: "lead not found",
        })),
      });
      leadsAllSkipped++;
      channelsSkipped += channels.length;
      continue;
    }

    const r = await reachoutLead({ lead, channels, changedBy: user.userId });
    results.push({
      leadId: id,
      bucket: lead.bucket,
      outcomes: r.outcomes,
    });

    let anySent = false;
    let anyFailed = false;
    let allSkipped = true;
    for (const o of r.outcomes) {
      if (o.status === "sent") { channelsSent++; anySent = true; allSkipped = false; }
      else if (o.status === "failed") { channelsFailed++; anyFailed = true; allSkipped = false; }
      else channelsSkipped++;
    }
    if (anySent) leadsSent++;
    else if (allSkipped) leadsAllSkipped++;
    else if (anyFailed) leadsAllFailed++;

    if (i < leadIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return NextResponse.json({
    total: leadIds.length,
    leadsSent,
    leadsAllFailed,
    leadsAllSkipped,
    channelsSent,
    channelsFailed,
    channelsSkipped,
    channels,
    results,
  });
}
