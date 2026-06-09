/** POST /api/session-plans/[pairingId]/finalize
 *
 *  Finalize (or re-finalize) the plan. Marks status="finalized", stamps
 *  finalizedAt, and — crucially — PUBLISHES the plan into the pairing's
 *  Session rows, which are the per-pairing source of truth read by the Sesi
 *  page, scheduling (the "Session to discuss" dropdown), dashboards and the
 *  Documents screen. Re-finalizing republishes (so later edits propagate);
 *  the mentee is emailed only on the first finalize.
 *
 *  No mentee acceptance step — finalize is the mentor's commitment.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { validatePlan, normalizeRows, enabledRows, type SessionPlanRow } from "@/lib/session-plan-defaults";
import { CURRICULUM } from "@/lib/curriculum";
import { sendSessionPlanFinalizedEmail } from "@/lib/email-templates";

const CURRICULUM_BY_NUM = new Map(CURRICULUM.map((s) => [s.sessionNum, s]));

/** Publish the plan rows into the pairing's Session table. Content fields are
 *  overwritten from the plan; per-session PROGRESS (status / scheduledAt /
 *  completedAt / ratings / notes) is never touched. Removed sessions are
 *  deleted only when they have no progress, so real history is preserved. */
async function publishToSessions(pairingId: string, rows: SessionPlanRow[], nowIso: string) {
  const { data: existingRows } = await supabase
    .from("Session")
    .select("sessionNum, status, scheduledAt, completedAt")
    .eq("pairingId", pairingId);

  const existing = new Map<number, { status: string; scheduledAt: string | null; completedAt: string | null }>();
  for (const s of existingRows || []) {
    existing.set(s.sessionNum as number, {
      status: s.status as string,
      scheduledAt: (s.scheduledAt as string | null) ?? null,
      completedAt: (s.completedAt as string | null) ?? null,
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sessionNum = i + 1; // position among the HELD sessions = live session number
    // Core sessions (curriculumNum set, incl. duplicates) take their locked
    // title + documents from the curriculum, so they're always correct
    // regardless of order/rename. Custom sessions keep their own title and
    // carry NO template (docChecklist null → upload-only).
    const tpl = r.curriculumNum != null ? CURRICULUM_BY_NUM.get(r.curriculumNum) : undefined;
    const content = {
      topic: tpl?.topic ?? r.title,
      phase: String(r.phase).toLowerCase(), // Session.phase is the lowercase enum
      durationMinutes: r.durationMinutes ?? null,
      objective: tpl?.objective ?? r.objective ?? null,
      deliverables: tpl?.deliverables ?? r.deliverables ?? null,
      menteePrep: tpl?.menteePrep ?? r.menteePrep ?? null,
      mentorPrep: tpl?.mentorPrep ?? r.mentorPrep ?? null,
      docChecklist: tpl?.docChecklist ?? r.docChecklist ?? null,
      updatedAt: nowIso,
    };
    if (existing.has(sessionNum)) {
      await supabase.from("Session").update(content).eq("pairingId", pairingId).eq("sessionNum", sessionNum);
    } else {
      await supabase.from("Session").insert({
        id: globalThis.crypto.randomUUID(),
        pairingId,
        sessionNum,
        status: "upcoming",
        createdAt: nowIso,
        ...content,
      });
    }
  }

  // Drop sessions beyond the new plan length — but only untouched ones.
  for (const [num, s] of existing) {
    if (num > rows.length && s.status === "upcoming" && !s.scheduledAt && !s.completedAt) {
      await supabase.from("Session").delete().eq("pairingId", pairingId).eq("sessionNum", num);
    }
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId, mentor:User!mentorId(name), mentee:User!menteeId(name, email)")
    .eq("id", pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  if (user.role !== "admin" && pairing.mentorId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: plan } = await supabase
    .from("SessionPlan")
    .select("status, rows")
    .eq("pairingId", pairingId)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Draft plan not found — open the planner first." }, { status: 404 });

  const rows = normalizeRows(plan.rows as SessionPlanRow[]);
  const issue = validatePlan(rows);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  // Only the held sessions are published, in order.
  const published = enabledRows(rows);

  // First finalize = notify the mentee; re-finalize just republishes silently.
  const isFirstFinalize = plan.status !== "finalized";

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("SessionPlan")
    .update({ status: "finalized", finalizedAt: nowIso, updatedAt: nowIso })
    .eq("pairingId", pairingId)
    .select("id, status, finalizedAt")
    .single();
  if (error) {
    console.error("[finalize] update failed", error);
    return NextResponse.json({ error: "Gagal finalisasi." }, { status: 500 });
  }

  // Publish into Session rows (the per-pairing source of truth). Best-effort:
  // if it fails the plan stays finalized and a re-finalize will retry.
  try {
    await publishToSessions(pairingId, published, nowIso);
  } catch (err) {
    console.error("[finalize] publish to Session failed", err);
  }

  if (isFirstFinalize) {
    const mentee = pairing.mentee as unknown as { name: string; email: string } | null;
    const mentor = pairing.mentor as unknown as { name: string } | null;
    if (mentee?.email) {
      try {
        await sendSessionPlanFinalizedEmail({
          to: mentee.email,
          menteeName: mentee.name || mentee.email.split("@")[0],
          mentorName: mentor?.name || user.name,
          pairingId,
          totalSessions: published.length,
        });
      } catch (err) {
        console.error("[finalize] email send failed", err);
      }
    }
    await supabase.from("Notification").insert({
      id: globalThis.crypto.randomUUID(),
      userId: pairing.menteeId,
      title: "Rencana sesi siap",
      message: `${mentor?.name || user.name} sudah menyusun ${published.length} sesi untuk perjalanan mentoring kamu.`,
      type: "session",
      read: false,
      link: `/dashboard/sesi`,
      createdAt: nowIso,
    });
  }

  return NextResponse.json({ plan: updated });
}
