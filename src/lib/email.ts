import "server-only";

import crypto from "crypto";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { LEAD_EMAIL_TEMPLATE_COLUMNS } from "@/lib/db-columns";
import { completeStepByTrigger } from "./leads/step-helpers";
import {
  templateBucketFor,
  fundingPlanLabelId,
  type Lead,
  type LeadEmailTemplate,
} from "./leads/types";

/**
 * Lead outreach email infrastructure.
 *
 * - `renderLeadOutreach(lead)` looks up the bucket-appropriate template
 *   row from `LeadEmailTemplate` and substitutes `{{name}}`,
 *   `{{campusJurusan}}`, `{{fundingPlan}}` tokens. Returns null for
 *   buckets without a template (currently only `unclassified`).
 *
 * - `sendLeadEmail(...)` wraps the Resend SDK call, always writes an
 *   `OutreachLog` row (success or failure — admins need failed sends
 *   visible for debugging), and on success: auto-completes any step
 *   with `autoTrigger="email_sent"` AND advances `Lead.stage` from
 *   `new` → `outreach_sent` (writing the matching LeadStageHistory).
 *
 * All outreach is plain text (Resend `text` field, NOT `html`) — the
 * voice is personal/conversational ("Kak Razak"), so HTML overhead
 * would feel off-tone.
 */

const FROM_ADDRESS = "Kak Razak - Satu Tuju Free Study Abroad Mentorship Program <ilham.razak@satutuju.id>";
const REPLY_TO = "ilham.razak@satutuju.id";

export interface RenderedOutreach {
  subject: string;
  body: string;
  templateUsed: string; // matches TEMPLATE_BUCKETS keys: "A_B_C" | "D" | "incomplete" | "domestic"
}

/** Replace `{{token}}` placeholders. Unknown tokens render as empty. */
function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? "");
}

/**
 * Look up the email template for `lead.bucket`, substitute tokens.
 * Returns null if the lead is in `unclassified` (no template) or the
 * DB row is missing (which would be a config error — surface 500 upstream).
 */
export async function renderLeadOutreach(lead: Lead): Promise<RenderedOutreach | null> {
  const templateBucket = templateBucketFor(lead.bucket);
  if (!templateBucket) return null;

  const { data, error } = await supabase
    .from("LeadEmailTemplate")
    .select(LEAD_EMAIL_TEMPLATE_COLUMNS)
    .eq("bucket", templateBucket)
    .single();
  if (error || !data) return null;

  const t = data as LeadEmailTemplate;
  const tokens: Record<string, string> = {
    name: lead.name,
    campusJurusan: lead.targetCampusAndProgram || "(belum diisi)",
    fundingPlan: fundingPlanLabelId(lead.fundingPlan),
  };

  return {
    subject: substitute(t.subject, tokens),
    body: substitute(t.body, tokens),
    templateUsed: templateBucket,
  };
}

function outreachLogId(): string {
  return "olg_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

function historyId(): string {
  return "lsh_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

export interface SendLeadEmailParams {
  to: string;
  subject: string;
  body: string;       // plain text
  leadId: string;
  bucket: string;     // for tagging Resend event payload
  templateUsed: string;
  currentStage: string;
  changedBy: string;  // userId for LeadStageHistory; "system" if cron
}

export interface SendLeadEmailResult {
  ok: boolean;
  outreachId: string;
  resendMessageId: string | null;
  stageAdvanced: boolean;
  error?: string;
}

/**
 * Send one outreach email + record-keeping. Always writes OutreachLog
 * (success path uses status="sent"; failure path uses status="failed"
 * + errorMessage so the admin can see what went wrong).
 */
export async function sendLeadEmail(
  params: SendLeadEmailParams,
): Promise<SendLeadEmailResult> {
  const { to, subject, body, leadId, bucket, templateUsed, currentStage, changedBy } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const olgId = outreachLogId();
  const now = new Date().toISOString();

  // Defensive: no API key means we can't send, but still log the
  // attempt so the operator sees what tried to go out.
  if (!apiKey) {
    await supabase.from("OutreachLog").insert({
      id: olgId, leadId, channel: "email", templateUsed, subject, body,
      sentAt: now, status: "failed", errorMessage: "RESEND_API_KEY not set",
    });
    return {
      ok: false, outreachId: olgId, resendMessageId: null, stageAdvanced: false,
      error: "RESEND_API_KEY not set",
    };
  }

  const resend = new Resend(apiKey);
  let resendId: string | null = null;
  let sendErr: string | null = null;

  try {
    const res = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      replyTo: REPLY_TO,
      subject,
      text: body,
      // Resend tags echo back in webhook events — lets us correlate
      // engagement to the originating lead without hitting the DB.
      tags: [
        { name: "lead_id", value: leadId },
        { name: "bucket", value: bucket },
      ],
    });
    if (res.error) {
      sendErr = res.error.message ?? "Resend rejected the send";
    } else {
      resendId = res.data?.id ?? null;
    }
  } catch (e) {
    sendErr = e instanceof Error ? e.message : "Unknown Resend error";
  }

  // Always-write OutreachLog so failures are audit-visible.
  await supabase.from("OutreachLog").insert({
    id: olgId,
    leadId,
    channel: "email",
    templateUsed,
    subject,
    body,
    sentAt: now,
    status: sendErr ? "failed" : "sent",
    resendMessageId: resendId,
    errorMessage: sendErr,
  });

  if (sendErr) {
    return {
      ok: false, outreachId: olgId, resendMessageId: null, stageAdvanced: false,
      error: sendErr,
    };
  }

  // ── Success-only side-effects ────────────────────────────────────────
  // 1. Auto-complete every step listening for `email_sent` trigger.
  await completeStepByTrigger(leadId, "email_sent");

  // 2. Update Lead.outreachSentAt + advance stage from "new" to
  //    "outreach_sent" (monotonic — never overwrite a later stage).
  let stageAdvanced = false;
  const leadPatch: Record<string, unknown> = {
    outreachSentAt: now,
    updatedAt: now,
  };
  if (currentStage === "new") {
    leadPatch.stage = "outreach_sent";
    stageAdvanced = true;
  }
  await supabase.from("Lead").update(leadPatch).eq("id", leadId);

  // 3. Record the stage transition for the timeline.
  if (stageAdvanced) {
    await supabase.from("LeadStageHistory").insert({
      id: historyId(),
      leadId,
      fromStage: "new",
      toStage: "outreach_sent",
      changedBy,
      note: `Outreach sent (template: ${templateUsed})`,
      createdAt: now,
    });
  }

  return {
    ok: true, outreachId: olgId, resendMessageId: resendId, stageAdvanced,
  };
}
