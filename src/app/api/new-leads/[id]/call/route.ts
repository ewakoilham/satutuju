import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LEAD_SELECT_COLUMNS } from "@/lib/db-columns";

/**
 * Persist call-cockpit form data: readiness score, call notes, red
 * flags, deposit tier, assigned interviewer, and per-stage notes.
 *
 * Phase 11: this route NO LONGER advances stage. Stage advancement
 * happens via:
 *   - PATCH /api/new-leads/[id]/stage (free admin dropdown)
 *   - Pipeline checklist clicks (stage-click steps call /stage internally)
 *   - Terminal decision buttons in DecisionPad (call /stage)
 *
 * The `decision` and `markCompleted` body fields are ignored
 * (deprecated). They remain accepted for backwards compatibility with
 * any older clients but produce no side effects.
 *
 * Body: {
 *   readinessScore?: number 0-6,
 *   callNotes?: string,
 *   redFlags?: string,
 *   depositTier?: 1 | 2 | 3 | null,
 *   assignedInterviewer?: string | null,
 *   stageNote?: string | null,
 * }
 */
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

  // Verify lead exists (lightweight check; full row returned in update)
  const { error: lookupErr } = await supabase
    .from("Lead")
    .select("id")
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.readinessScore !== undefined) {
    const n = Number(body.readinessScore);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      return NextResponse.json({ error: "readinessScore must be 0-6" }, { status: 400 });
    }
    update.readinessScore = n;
  }
  if (typeof body.callNotes === "string") update.callNotes = body.callNotes.slice(0, 5000);
  if (body.callNotes === null) update.callNotes = null;
  if (typeof body.redFlags === "string") update.redFlags = body.redFlags.slice(0, 2000);
  if (body.redFlags === null) update.redFlags = null;
  if (body.depositTier !== undefined) {
    if (body.depositTier === null) {
      update.depositTier = null;
    } else {
      const t = Number(body.depositTier);
      if (![1, 2, 3].includes(t)) {
        return NextResponse.json({ error: "depositTier must be 1, 2, 3, or null" }, { status: 400 });
      }
      update.depositTier = t;
    }
  }
  if (body.assignedInterviewer !== undefined) {
    if (body.assignedInterviewer === null) {
      update.assignedInterviewer = null;
    } else if (typeof body.assignedInterviewer === "string") {
      update.assignedInterviewer = body.assignedInterviewer.trim().slice(0, 50) || null;
    }
  }
  if (body.stageNote !== undefined) {
    if (body.stageNote === null) {
      update.stageNote = null;
    } else if (typeof body.stageNote === "string") {
      update.stageNote = body.stageNote.slice(0, 2000);
    }
  }

  const { data: updated, error: updErr } = await supabase
    .from("Lead")
    .update(update)
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ lead: updated });
}
