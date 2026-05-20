import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { OUTREACH_LOG_COLUMNS } from "@/lib/db-columns";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";
import { LEAD_STAGES, type OutreachLog } from "@/lib/leads/types";

/**
 * Resend webhook receiver. Resend pings this URL on email lifecycle
 * events (delivered, opened, clicked, bounced, complained). Verifies
 * the Svix-style signature, then mutates OutreachLog + Lead +
 * LeadStageHistory + LeadStepStatus accordingly.
 *
 * Configure in Resend dashboard:
 *   Webhook URL: ${APP_URL}/api/webhooks/resend
 *   Signing Secret: copy into RESEND_WEBHOOK_SECRET env var
 *
 * Idempotency: re-deliveries of the same event are safe.
 *   - First-write-wins semantics for openedAt/clickedAt.
 *   - completeStepByTrigger only flips PENDING rows.
 *   - Stage advancement is strictly monotonic (forward-only by index).
 *
 * Security: signature mismatch → 401. Unknown event types → accepted
 * silently. Unmatched email_id → accepted silently (lets domain-
 * verification test pings succeed without dirtying the log).
 */

export const runtime = "nodejs";

interface ResendEventData {
  email_id: string;
  [k: string]: unknown;
}
interface ResendEvent {
  type: string;
  created_at: string;
  data: ResendEventData;
}

/**
 * Returns `target` if it would be a forward step from `currentStage`
 * along LEAD_STAGES order. Returns null if equal or already past.
 */
function maybeAdvance(currentStage: string, target: string): string | null {
  const order = LEAD_STAGES as readonly string[];
  const ci = order.indexOf(currentStage);
  const ti = order.indexOf(target);
  if (ci < 0 || ti < 0) return null;
  return ti > ci ? target : null;
}

function historyId(): string {
  return "lsh_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Configuration error — operator must set the secret before
    // pointing Resend at this URL.
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET not set" },
      { status: 500 },
    );
  }

  // Svix requires the RAW body string (any whitespace tampering
  // invalidates the HMAC). Read once as text.
  const raw = await req.text();
  const headers: Record<string, string> = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ResendEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(raw, headers) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const messageId = event?.data?.email_id;
  if (!messageId) {
    // Resend's domain-verification probes don't carry email_id.
    return NextResponse.json({ ok: true, note: "no email_id in event" });
  }

  // Find the OutreachLog row this event is about.
  const { data: outreachRaw, error: oerr } = await supabase
    .from("OutreachLog")
    .select(OUTREACH_LOG_COLUMNS)
    .eq("resendMessageId", messageId)
    .single();
  if (oerr || !outreachRaw) {
    // Unmatched (test events, or send predates webhook config) —
    // accept so Resend doesn't keep retrying.
    return NextResponse.json({ ok: true, note: "no matching OutreachLog" });
  }
  const outreach = outreachRaw as unknown as OutreachLog;
  const leadId = outreach.leadId;
  const now = new Date().toISOString();

  switch (event.type) {
    case "email.delivered":
      // No-op; OutreachLog.status stays "sent".
      break;

    case "email.opened": {
      // 1. First-open-wins on the OutreachLog timestamp.
      if (!outreach.openedAt) {
        await supabase
          .from("OutreachLog")
          .update({ openedAt: now })
          .eq("id", outreach.id);
      }
      // 2. Mirror to Lead.emailOpenedAt + advance stage if applicable.
      const { data: lead } = await supabase
        .from("Lead")
        .select("stage, emailOpenedAt")
        .eq("id", leadId)
        .single();
      if (lead) {
        const leadPatch: Record<string, unknown> = { updatedAt: now };
        if (!lead.emailOpenedAt) leadPatch.emailOpenedAt = now;

        const nextStage = maybeAdvance(lead.stage as string, "email_opened");
        if (nextStage) {
          leadPatch.stage = nextStage;
          await supabase.from("LeadStageHistory").insert({
            id: historyId(),
            leadId,
            fromStage: lead.stage,
            toStage: nextStage,
            changedBy: "resend-webhook",
            note: "Email opened (Resend webhook)",
            createdAt: now,
          });
        }
        if (Object.keys(leadPatch).length > 1) {
          await supabase.from("Lead").update(leadPatch).eq("id", leadId);
        }
      }
      // 3. Auto-complete steps listening for email_opened.
      await completeStepByTrigger(leadId, "email_opened");
      break;
    }

    case "email.clicked": {
      if (!outreach.clickedAt) {
        await supabase
          .from("OutreachLog")
          .update({ clickedAt: now })
          .eq("id", outreach.id);
      }
      const { data: lead } = await supabase
        .from("Lead")
        .select("stage, emailClickedAt")
        .eq("id", leadId)
        .single();
      if (lead) {
        const leadPatch: Record<string, unknown> = { updatedAt: now };
        if (!lead.emailClickedAt) leadPatch.emailClickedAt = now;

        const nextStage = maybeAdvance(lead.stage as string, "email_clicked");
        if (nextStage) {
          leadPatch.stage = nextStage;
          await supabase.from("LeadStageHistory").insert({
            id: historyId(),
            leadId,
            fromStage: lead.stage,
            toStage: nextStage,
            changedBy: "resend-webhook",
            note: "Email clicked (Resend webhook)",
            createdAt: now,
          });
        }
        if (Object.keys(leadPatch).length > 1) {
          await supabase.from("Lead").update(leadPatch).eq("id", leadId);
        }
      }
      await completeStepByTrigger(leadId, "email_clicked");
      break;
    }

    case "email.bounced":
    case "email.complained": {
      // Flag the log row + capture reason if Resend provided one.
      // Recipient ESP rejected delivery (hard bounce) OR user marked
      // as spam (complaint). Both should pause future outreach to
      // this address — surface to admin via the OutreachLog status.
      const reasonRaw = (event.data as { reason?: unknown })?.reason;
      const reason = typeof reasonRaw === "string"
        ? reasonRaw
        : event.type === "email.complained" ? "complained (marked as spam)" : "bounced";
      await supabase
        .from("OutreachLog")
        .update({
          bouncedAt: now,
          status: "bounced",
          errorMessage: reason.slice(0, 500),
        })
        .eq("id", outreach.id);
      break;
    }

    default:
      // Other event types (email.sent, email.delivery_delayed,
      // email.failed) — accept but no DB mutation.
      break;
  }

  return NextResponse.json({ ok: true, type: event.type });
}
