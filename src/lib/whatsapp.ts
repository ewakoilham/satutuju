import "server-only";

import { supabase } from "@/lib/supabase";
import { LEAD_EMAIL_TEMPLATE_COLUMNS } from "@/lib/db-columns";
import { sendWhatsapp } from "@/lib/integrations/fonnte";
import { completeStepByTrigger } from "./leads/step-helpers";
import { newOutreachLogId, newStageHistoryId } from "./leads/ids";
import {
  templateBucketFor,
  fundingPlanLabelId,
  type Lead,
  type LeadEmailTemplate,
} from "./leads/types";

/**
 * Lead WhatsApp outreach infrastructure. Mirrors src/lib/email.ts but for
 * the WA channel via Fonnte gateway.
 *
 * - `renderLeadOutreachWhatsapp(lead)` reads `whatsappBody` from the
 *   bucket-appropriate `LeadEmailTemplate` row, substitutes the same
 *   tokens email uses. Returns null when (a) bucket = unclassified or
 *   (b) admin hasn't authored a WA body for that template yet.
 *
 * - `sendLeadWhatsapp(...)` wraps the Fonnte call, always writes an
 *   `OutreachLog` row with `channel="whatsapp"` (failures included),
 *   and on success auto-completes any step listening for
 *   `whatsapp_sent` trigger + advances stage `new` → `outreach_sent`.
 *
 * Note: there's no "subject" for WA. The OutreachLog.subject column is
 * required, so we record a synthetic label (e.g. "WhatsApp · A_B_C") so
 * admins can scan the channel-mixed log without confusion.
 */

export interface RenderedWhatsappOutreach {
  body: string;
  templateUsed: string;
}

function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => tokens[k] ?? "");
}

export async function renderLeadOutreachWhatsapp(
  lead: Lead,
): Promise<RenderedWhatsappOutreach | null> {
  const templateBucket = templateBucketFor(lead.bucket);
  if (!templateBucket) return null;

  const { data, error } = await supabase
    .from("LeadEmailTemplate")
    .select(LEAD_EMAIL_TEMPLATE_COLUMNS)
    .eq("bucket", templateBucket)
    .single();
  if (error || !data) return null;

  const t = data as LeadEmailTemplate;
  if (!t.whatsappBody || !t.whatsappBody.trim()) return null;

  const tokens: Record<string, string> = {
    name: lead.name,
    campusJurusan: lead.targetCampusAndProgram || "(belum diisi)",
    fundingPlan: fundingPlanLabelId(lead.fundingPlan),
  };

  return {
    body: substitute(t.whatsappBody, tokens),
    templateUsed: templateBucket,
  };
}

export interface SendLeadWhatsappParams {
  to: string;             // raw whatsappNumber from Lead — normalization happens in sendWhatsapp
  body: string;
  leadId: string;
  bucket: string;
  templateUsed: string;
  currentStage: string;
  changedBy: string;
}

export interface SendLeadWhatsappResult {
  ok: boolean;
  outreachId: string;
  fonnteMessageId: string | null;
  stageAdvanced: boolean;
  error?: string;
}

export async function sendLeadWhatsapp(
  params: SendLeadWhatsappParams,
): Promise<SendLeadWhatsappResult> {
  const { to, body, leadId, bucket, templateUsed, currentStage, changedBy } = params;
  const olgId = newOutreachLogId();
  const now = new Date().toISOString();
  const subjectLabel = `WhatsApp · ${templateUsed}`;

  const sendRes = await sendWhatsapp({ to, message: body });

  // Always-write OutreachLog (success or failure — admins need to see
  // failed attempts to debug e.g. invalid numbers, quota exhaustion).
  await supabase.from("OutreachLog").insert({
    id: olgId,
    leadId,
    channel: "whatsapp",
    templateUsed,
    subject: subjectLabel,
    body,
    sentAt: now,
    status: sendRes.ok ? "sent" : "failed",
    resendMessageId: sendRes.ok ? sendRes.messageId : null,
    errorMessage: sendRes.ok ? null : sendRes.error,
  });

  if (!sendRes.ok) {
    return {
      ok: false,
      outreachId: olgId,
      fonnteMessageId: null,
      stageAdvanced: false,
      error: sendRes.error,
    };
  }

  // Success side-effects mirror sendLeadEmail's behavior so the funnel
  // moves regardless of which channel triggered the first outreach.
  await completeStepByTrigger(leadId, "whatsapp_sent").catch(() => {});

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

  if (stageAdvanced) {
    await supabase.from("LeadStageHistory").insert({
      id: newStageHistoryId(),
      leadId,
      fromStage: "new",
      toStage: "outreach_sent",
      changedBy,
      note: `WA outreach sent (template: ${templateUsed})`,
      createdAt: now,
    });
  }

  return {
    ok: true,
    outreachId: olgId,
    fonnteMessageId: sendRes.messageId,
    stageAdvanced,
  };
}
