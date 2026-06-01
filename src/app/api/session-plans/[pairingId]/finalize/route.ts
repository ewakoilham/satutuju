/** POST /api/session-plans/[pairingId]/finalize
 *
 *  Finalize the draft plan. Validates row constraints again on the server
 *  side, marks status="finalized", stamps finalizedAt, and notifies the
 *  mentee (email via Resend). Subsequent finalize attempts are 409.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { validatePlan, type SessionPlanRow } from "@/lib/session-plan-defaults";
import { sendSessionPlanFinalizedEmail } from "@/lib/email-templates";

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
  if (plan.status === "finalized" || plan.status === "acknowledged") {
    return NextResponse.json({ error: "Rencana sesi sudah difinalisasi sebelumnya." }, { status: 409 });
  }

  const rows = plan.rows as SessionPlanRow[];
  const issue = validatePlan(rows);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });

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

  // Email mentee. Best-effort — if email fails we still keep the finalized
  // status (admin can resend manually).
  const mentee = (pairing.mentee as unknown as { name: string; email: string } | null);
  const mentor = (pairing.mentor as unknown as { name: string } | null);
  if (mentee?.email) {
    try {
      await sendSessionPlanFinalizedEmail({
        to: mentee.email,
        menteeName: mentee.name || mentee.email.split("@")[0],
        mentorName: mentor?.name || user.name,
        pairingId,
        totalSessions: rows.length,
      });
    } catch (err) {
      console.error("[finalize] email send failed", err);
    }
  }

  // Also drop an in-app notification.
  await supabase.from("Notification").insert({
    id: globalThis.crypto.randomUUID(),
    userId: pairing.menteeId,
    title: "Rencana sesi siap",
    message: `${mentor?.name || user.name} sudah menyusun ${rows.length} sesi untuk perjalanan mentoring kamu.`,
    type: "session",
    read: false,
    link: `/dashboard/mentee/${pairingId}/rencana-sesi`,
    createdAt: nowIso,
  });

  return NextResponse.json({ plan: updated });
}
