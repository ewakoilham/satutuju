import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_STEP_STATUS_COLUMNS } from "@/lib/db-columns";
import { STEP_STATUSES } from "@/lib/leads/types";

/**
 * Toggle/set status for one (lead, step) pair.
 *
 * Body: { status: "pending" | "done" | "skipped", note?: string }
 *
 * - When transitioning to "done": stamps completedAt + completedBy = userId.
 * - When transitioning to "pending" or "skipped": clears completedAt/By.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id: leadId, stepId } = await params;
  let body: { status?: unknown; note?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.status !== "string" || !(STEP_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "status must be one of " + STEP_STATUSES.join("|") }, { status: 400 });
  }
  const status = body.status as (typeof STEP_STATUSES)[number];

  // Server-side guard: auto-trigger steps are driven by system events
  // (email send, stage transitions, etc.) — manual PATCH here would
  // desync step status from the underlying stage and confuse the funnel.
  // Reject unless the caller passes { force: true } explicitly.
  const force = body.force === true;
  if (!force) {
    const { data: stepDef } = await supabase
      .from("LeadStepDefinition")
      .select("autoTrigger, label")
      .eq("id", stepId)
      .single();
    if (stepDef?.autoTrigger) {
      return NextResponse.json(
        {
          error: `Step "${stepDef.label}" adalah auto-trigger (${stepDef.autoTrigger}) — tidak bisa di-toggle manual. Advance stage lewat /stage endpoint atau Decision Pad untuk auto-fire step ini. Pass { force: true } untuk override (debug-only).`,
        },
        { status: 409 },
      );
    }
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    updatedAt: now,
  };
  if (status === "done") {
    update.completedAt = now;
    update.completedBy = user.userId;
  } else {
    update.completedAt = null;
    update.completedBy = null;
  }
  if (typeof body.note === "string") {
    update.note = body.note.trim().slice(0, 500);
  } else if (body.note === null) {
    update.note = null;
  }

  const { data, error } = await supabase
    .from("LeadStepStatus")
    .update(update)
    .eq("leadId", leadId)
    .eq("stepId", stepId)
    .select(LEAD_STEP_STATUS_COLUMNS)
    .single();
  if (error) {
    const code = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status: code });
  }

  return NextResponse.json({ status: data });
}
