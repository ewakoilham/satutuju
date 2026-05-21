import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { OUTREACH_LOG_COLUMNS } from "@/lib/db-columns";
import { completeStepByTrigger } from "@/lib/leads/step-helpers";
import { maybeAdvanceStage, type OutreachLog } from "@/lib/leads/types";
import { newStageHistoryId } from "@/lib/leads/ids";

/**
 * Fonnte WhatsApp webhook receiver. Fonnte pings this URL on outbound
 * message lifecycle events (sent, delivered, read, failed). Mutates
 * OutreachLog + Lead + LeadStageHistory + LeadStepStatus accordingly.
 *
 * Configure in Fonnte dashboard:
 *   Device → Token modal → "Webhook Message Status" field:
 *     ${APP_URL}/api/webhooks/fonnte
 *   (NOT the generic "Webhook" field — that's for incoming reply
 *   messages, a separate feature we may build in a later phase.)
 *
 * Authentication: Fonnte doesn't sign requests (no HMAC), so we
 * validate the inbound payload by:
 *   1. Confirming `device` matches the configured WA device number
 *      (env: FONNTE_DEVICE_NUMBER) — anyone hitting our URL without
 *      knowing our specific device gets 401.
 *   2. Optional shared-secret check via `FONNTE_WEBHOOK_SECRET` —
 *      if set, the inbound body must include matching `token` field.
 *
 * Idempotency: re-deliveries of the same event are safe. openedAt is
 * first-write-wins; stage advancement is monotonic.
 *
 * Fonnte event payload shape (rough — varies slightly per status):
 *   {
 *     "device":  "6285726286788",
 *     "id":      "<message id returned by /send>",
 *     "status":  "sent" | "delivered" | "read" | "failed",
 *     "target":  "6281234567890",
 *     "message": "..." (sometimes),
 *     "reason":  "..." (when status=failed)
 *   }
 *
 * We map Fonnte status → our action:
 *   sent      → noop (already recorded by sendLeadWhatsapp)
 *   delivered → noop (we don't track delivered separately)
 *   read      → openedAt + advance stage outreach_sent → whatsapp_read
 *               (whatsapp_read sits between outreach_sent and email_opened
 *                so monotonic advance still works — if email is later
 *                opened or clicked, the stage progresses forward.)
 *   failed    → bouncedAt + status="bounced" + history note
 */

export const runtime = "nodejs";

interface FonnteWebhookBody {
  device?: string;
  id?: string;
  status?: string;
  target?: string;
  message?: string;
  reason?: string;
  token?: string;
  [k: string]: unknown;
}

export async function POST(req: NextRequest) {
  // Fonnte may post application/json OR application/x-www-form-urlencoded.
  // Try JSON first, fall back to form-encoded.
  const ct = req.headers.get("content-type") ?? "";
  let body: FonnteWebhookBody;
  try {
    if (ct.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();
      body = Object.fromEntries(form.entries()) as FonnteWebhookBody;
    }
  } catch {
    return NextResponse.json({ error: "Could not parse body" }, { status: 400 });
  }

  // ─── Auth gates ─────────────────────────────────────────────────
  // 1. Optional shared-secret check.
  const expectedSecret = process.env.FONNTE_WEBHOOK_SECRET;
  if (expectedSecret && body.token !== expectedSecret) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  // 2. Device match — reject inbound from other devices.
  const expectedDevice = process.env.FONNTE_DEVICE_NUMBER;
  if (expectedDevice && body.device && body.device !== expectedDevice) {
    return NextResponse.json({ error: "Wrong device" }, { status: 401 });
  }

  const messageId = body.id;
  const status = (body.status ?? "").toLowerCase();
  if (!messageId || !status) {
    return NextResponse.json({ ok: true, note: "no id/status in payload" });
  }

  // Look up the OutreachLog row. We reuse `resendMessageId` for Fonnte's
  // message id — the column name predates the multi-channel design.
  const { data: outreachRaw, error: oerr } = await supabase
    .from("OutreachLog")
    .select(OUTREACH_LOG_COLUMNS)
    .eq("resendMessageId", messageId)
    .eq("channel", "whatsapp")
    .single();
  if (oerr || !outreachRaw) {
    // Unmatched (test pings or message sent before this webhook was
    // configured) — accept silently so Fonnte stops retrying.
    return NextResponse.json({ ok: true, note: "no matching OutreachLog" });
  }
  const outreach = outreachRaw as unknown as OutreachLog;
  const leadId = outreach.leadId;
  const now = new Date().toISOString();

  switch (status) {
    case "sent":
    case "delivered":
      // No-op. "sent" is already recorded by sendLeadWhatsapp at the
      // moment of dispatch; "delivered" (one check) doesn't promote
      // anything in our funnel.
      break;

    case "read": {
      // 1. First-read-wins on the OutreachLog timestamp.
      if (!outreach.openedAt) {
        await supabase
          .from("OutreachLog")
          .update({ openedAt: now })
          .eq("id", outreach.id);
      }
      // 2. Advance Lead.stage → whatsapp_read (monotonic, idempotent).
      //    We do NOT mirror to Lead.emailOpenedAt — that's email-specific.
      //    WhatsApp read engagement is captured by OutreachLog.openedAt
      //    on the whatsapp-channel row above + the stage itself.
      const { data: lead } = await supabase
        .from("Lead")
        .select("stage")
        .eq("id", leadId)
        .single();
      if (lead) {
        const nextStage = maybeAdvanceStage(lead.stage as string, "whatsapp_read");
        if (nextStage) {
          await supabase
            .from("Lead")
            .update({ stage: nextStage, updatedAt: now })
            .eq("id", leadId);
          await supabase.from("LeadStageHistory").insert({
            id: newStageHistoryId(),
            leadId,
            fromStage: lead.stage,
            toStage: nextStage,
            changedBy: "fonnte-webhook",
            note: "WhatsApp read (Fonnte webhook)",
            createdAt: now,
          });
        }
      }
      // 3. Auto-complete steps listening for whatsapp_read.
      await completeStepByTrigger(leadId, "whatsapp_read");
      break;
    }

    case "failed":
    case "rejected":
    case "expired": {
      const reason = typeof body.reason === "string"
        ? body.reason
        : `WhatsApp ${status}`;
      await supabase
        .from("OutreachLog")
        .update({
          bouncedAt: now,
          status: "bounced",
          errorMessage: reason.slice(0, 500),
        })
        .eq("id", outreach.id);
      // Don't advance/regress stage — admin reviews failed sends manually.
      break;
    }

    default:
      // Unknown status — accept but no DB mutation.
      break;
  }

  return NextResponse.json({ ok: true, status });
}
