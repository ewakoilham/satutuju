import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  LEAD_SELECT_COLUMNS,
  LEAD_STAGE_HISTORY_COLUMNS,
  OUTREACH_LOG_COLUMNS,
  LEAD_STEP_DEFINITION_COLUMNS,
  LEAD_STEP_STATUS_COLUMNS,
} from "@/lib/db-columns";

/**
 * Read a single lead with all related rows for the detail page:
 * - lead
 * - history (LeadStageHistory)
 * - outreach (OutreachLog)
 * - steps  (LeadStepDefinition[]) — all active steps, in display order
 * - statuses (LeadStepStatus[])   — this lead's row per step
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;

  const [leadRes, historyRes, outreachRes, stepsRes, statusesRes] = await Promise.all([
    supabase.from("Lead").select(LEAD_SELECT_COLUMNS).eq("id", id).single(),
    supabase.from("LeadStageHistory").select(LEAD_STAGE_HISTORY_COLUMNS).eq("leadId", id).order("createdAt", { ascending: false }),
    supabase.from("OutreachLog").select(OUTREACH_LOG_COLUMNS).eq("leadId", id).order("sentAt", { ascending: false }),
    supabase.from("LeadStepDefinition").select(LEAD_STEP_DEFINITION_COLUMNS).eq("isActive", true).order("order", { ascending: true }),
    supabase.from("LeadStepStatus").select(LEAD_STEP_STATUS_COLUMNS).eq("leadId", id),
  ]);

  if (leadRes.error) {
    const code = leadRes.error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: leadRes.error.message }, { status: code });
  }

  return NextResponse.json({
    lead: leadRes.data,
    history: historyRes.data ?? [],
    outreach: outreachRes.data ?? [],
    steps: stepsRes.data ?? [],
    statuses: statusesRes.data ?? [],
  });
}

/** PATCH — update editable lead fields (name, email, whatsapp, target, funding, etc.). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist editable fields. System-derived (bucket, stage, etc.) only via
  // dedicated endpoints later.
  const EDITABLE = [
    "name", "email", "whatsappNumber", "targetCampusAndProgram", "fundingPlan",
    "assignedInterviewer", "depositTier", "readinessScore",
    "callScheduledAt", "callCompletedAt", "callNotes", "redFlags", "decision",
    "mentorMatchedId",
  ] as const;

  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }
  update.updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("Lead")
    .update(update)
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lead: data });
}

/**
 * DELETE — permanently remove a lead + all its dependent rows
 * (LeadStageHistory / OutreachLog / LeadStepStatus cascade via Prisma
 * `onDelete: Cascade` on the relation).
 *
 * Destructive. Caller must pass `?confirm=<lead.name>` matching the
 * lead's stored name (URL-encoded) — defense-in-depth on top of the
 * UI's type-name-to-confirm modal. Off-by-one mistakes (wrong tab,
 * wrong row) get caught here.
 *
 * Audit trail is intentionally NOT preserved — once deleted, the row
 * is gone. Rollback path = re-sync from Tally (if the lead was Tally-
 * sourced; tallySubmissionId unique constraint still holds).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const expectedName = url.searchParams.get("confirm");
  if (!expectedName) {
    return NextResponse.json(
      { error: "Missing ?confirm=<lead name> query param. UI must include the lead's name to confirm intent." },
      { status: 400 },
    );
  }

  // Fetch the lead first to verify the confirmation matches AND to
  // surface a clear 404 vs 500.
  const { data: lead, error: lookupErr } = await supabase
    .from("Lead").select("id, name, email, tallySubmissionId").eq("id", id).single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }
  if (lead.name.trim() !== expectedName.trim()) {
    return NextResponse.json(
      { error: `Confirmation name mismatch. Expected "${lead.name}", got "${expectedName}".` },
      { status: 400 },
    );
  }

  const { error: delErr } = await supabase.from("Lead").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    deletedId: id,
    deletedName: lead.name,
    tallyBackedUp: lead.tallySubmissionId !== null,
  });
}
