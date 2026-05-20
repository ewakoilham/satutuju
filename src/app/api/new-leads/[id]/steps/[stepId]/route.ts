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
  let body: { status?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.status !== "string" || !(STEP_STATUSES as readonly string[]).includes(body.status)) {
    return NextResponse.json({ error: "status must be one of " + STEP_STATUSES.join("|") }, { status: 400 });
  }
  const status = body.status as (typeof STEP_STATUSES)[number];

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
