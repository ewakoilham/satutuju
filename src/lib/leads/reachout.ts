import "server-only";

import { renderLeadOutreach, sendLeadEmail } from "@/lib/email";
import { renderLeadOutreachWhatsapp, sendLeadWhatsapp } from "@/lib/whatsapp";
import type { Lead, OutreachChannel } from "@/lib/leads/types";

/**
 * Multi-channel reachout orchestrator. Dispatches a single lead's
 * outreach across one or both channels (email, whatsapp).
 *
 * Per-channel failures are independent — if email succeeds but WA fails,
 * email's OutreachLog is still written + stage still advances.
 *
 * Skip conditions (each channel can skip independently):
 *   - email: lead.bucket = unclassified (no template)
 *   - whatsapp: lead.whatsappNumber blank, OR template lacks whatsappBody
 *
 * Skipped channels are NOT failures — they're explicitly reported so the
 * UI can show "1 sent, 1 skipped (no WA number)" without alarming the
 * admin.
 *
 * NOTE: channels run sequentially (not parallel). Why: both send
 * functions independently advance Lead.stage from "new" → "outreach_sent"
 * and write LeadStageHistory. If we ran them in parallel both would
 * observe stage="new" from their snapshot args and both would insert a
 * duplicate history row. Sequential keeps the snapshot fresh: by the
 * time the 2nd channel calls, the 1st has already moved stage past "new"
 * (when applicable), so the 2nd's monotonic guard is a no-op for the
 * history insert. The ~500ms latency cost is negligible.
 */

export type ChannelOutcome =
  | { channel: OutreachChannel; status: "sent"; outreachId: string; templateUsed: string; messageId: string | null }
  | { channel: OutreachChannel; status: "failed"; outreachId: string; templateUsed: string; error: string }
  | { channel: OutreachChannel; status: "skipped"; reason: string };

export interface ReachoutResult {
  leadId: string;
  bucket: string;
  outcomes: ChannelOutcome[];
  stageAdvanced: boolean;
}

export interface ReachoutLeadArgs {
  lead: Lead;
  channels: readonly OutreachChannel[];
  changedBy: string;
}

export async function reachoutLead(args: ReachoutLeadArgs): Promise<ReachoutResult> {
  const { lead, channels, changedBy } = args;
  const outcomes: ChannelOutcome[] = [];
  let stageAdvanced = false;
  // Mutable view of stage so the 2nd channel sees the result of the 1st.
  let currentStage = lead.stage;

  if (channels.includes("email")) {
    const rendered = await renderLeadOutreach(lead);
    if (!rendered) {
      outcomes.push({
        channel: "email",
        status: "skipped",
        reason: `no email template for bucket ${lead.bucket} (override bucket first)`,
      });
    } else {
      const r = await sendLeadEmail({
        to: lead.email,
        subject: rendered.subject,
        body: rendered.body,
        leadId: lead.id,
        bucket: lead.bucket,
        templateUsed: rendered.templateUsed,
        currentStage,
        changedBy,
      });
      outcomes.push(
        r.ok
          ? {
              channel: "email",
              status: "sent",
              outreachId: r.outreachId,
              templateUsed: rendered.templateUsed,
              messageId: r.resendMessageId,
            }
          : {
              channel: "email",
              status: "failed",
              outreachId: r.outreachId,
              templateUsed: rendered.templateUsed,
              error: r.error ?? "unknown error",
            },
      );
      if (r.ok && r.stageAdvanced) {
        stageAdvanced = true;
        currentStage = "outreach_sent";
      }
    }
  }

  if (channels.includes("whatsapp")) {
    if (!lead.whatsappNumber) {
      outcomes.push({
        channel: "whatsapp",
        status: "skipped",
        reason: "lead has no whatsappNumber",
      });
    } else {
      const waRendered = await renderLeadOutreachWhatsapp(lead);
      if (!waRendered) {
        outcomes.push({
          channel: "whatsapp",
          status: "skipped",
          reason: `no WA template body for bucket ${lead.bucket} (add WhatsApp body in template editor)`,
        });
      } else {
        const r = await sendLeadWhatsapp({
          to: lead.whatsappNumber,
          body: waRendered.body,
          leadId: lead.id,
          bucket: lead.bucket,
          templateUsed: waRendered.templateUsed,
          currentStage,
          changedBy,
        });
        outcomes.push(
          r.ok
            ? {
                channel: "whatsapp",
                status: "sent",
                outreachId: r.outreachId,
                templateUsed: waRendered.templateUsed,
                messageId: r.fonnteMessageId,
              }
            : {
                channel: "whatsapp",
                status: "failed",
                outreachId: r.outreachId,
                templateUsed: waRendered.templateUsed,
                error: r.error ?? "unknown error",
              },
        );
        if (r.ok && r.stageAdvanced) {
          stageAdvanced = true;
          currentStage = "outreach_sent";
        }
      }
    }
  }

  return {
    leadId: lead.id,
    bucket: lead.bucket,
    outcomes,
    stageAdvanced,
  };
}
