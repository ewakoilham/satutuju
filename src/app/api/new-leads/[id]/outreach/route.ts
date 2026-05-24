import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS, OUTREACH_LOG_COLUMNS } from "@/lib/db-columns";
import { reachoutLead } from "@/lib/leads/reachout";
import { OUTREACH_CHANNELS, type Lead, type OutreachChannel } from "@/lib/leads/types";

/**
 * Send outreach to a single lead across one or both channels
 * (email, whatsapp). Admin-gated.
 *
 * Body: { channels?: ("email"|"whatsapp")[] }
 *   - defaults to ["email"] for backward compatibility
 *   - ["whatsapp"] for WA-only
 *   - ["email","whatsapp"] for both
 *
 * Response:
 *   - 200 + outcomes[] if at least one channel completed (sent/failed/skipped)
 *   - 400 if both requested channels skipped (so the admin gets a clear
 *     "nothing was sent" signal)
 *
 * Side-effects (handled inside reachoutLead → sendLeadEmail/sendLeadWhatsapp):
 *   - OutreachLog row per channel that ran (always, even on failure).
 *   - Auto-completes steps with autoTrigger="email_sent" or "whatsapp_sent".
 *   - Advances Lead.stage `new` → `outreach_sent` (once, monotonic).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;

  // Parse body — body is optional; missing/invalid JSON defaults to email-only.
  let channels: OutreachChannel[] = ["email"];
  try {
    const body = await req.json();
    if (Array.isArray(body?.channels)) {
      const validated = body.channels.filter(
        (c: unknown): c is OutreachChannel =>
          typeof c === "string" && (OUTREACH_CHANNELS as readonly string[]).includes(c),
      );
      if (validated.length > 0) channels = validated;
    }
  } catch {
    /* empty body OK → keep default ["email"] */
  }

  const { data: lead, error: lookupErr } = await supabase
    .from("Lead")
    .select(LEAD_SELECT_COLUMNS)
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  // Phase 15: hard gate. Outreach (auto or manual) requires the admin
  // to have explicitly reviewed (or overridden) the classification.
  // 409 Conflict — the request is well-formed but the lead state
  // doesn't permit it yet.
  const typedLead = lead as unknown as Lead;
  if (!typedLead.classificationReviewedAt) {
    return NextResponse.json(
      { ok: false, error: "Klasifikasi belum direview admin. Konfirmasi klasifikasi dulu sebelum kirim outreach." },
      { status: 409 },
    );
  }

  const result = await reachoutLead({
    lead: typedLead,
    channels,
    changedBy: user.userId,
  });

  // Fetch the OutreachLog rows we just wrote (any channel that wasn't
  // skipped) so the UI can render them in the sent-history list.
  const outreachIds = result.outcomes
    .filter((o) => o.status !== "skipped")
    .map((o) => (o as { outreachId: string }).outreachId);
  let outreach: unknown[] = [];
  if (outreachIds.length > 0) {
    const { data } = await supabase
      .from("OutreachLog")
      .select(OUTREACH_LOG_COLUMNS)
      .in("id", outreachIds);
    outreach = data ?? [];
  }

  const allSkipped = result.outcomes.every((o) => o.status === "skipped");
  if (allSkipped) {
    return NextResponse.json(
      { ok: false, error: "Semua channel di-skip — cek bucket + WA number", ...result, outreach },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    ...result,
    outreach,
  });
}
