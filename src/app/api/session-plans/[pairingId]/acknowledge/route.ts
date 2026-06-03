/** POST /api/session-plans/[pairingId]/acknowledge
 *
 *  The MENTEE accepts a finalized session plan. Flips status
 *  "finalized" → "acknowledged" + stamps acknowledgedAt, then notifies the
 *  mentor so their side unlocks (card moves from "menunggu" to active sessions).
 *
 *  Mentee-only. 409 if the plan isn't finalized (nothing to accept yet) or is
 *  already acknowledged.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId, mentee:User!menteeId(name)")
    .eq("id", pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing not found" }, { status: 404 });

  // Only the mentee on this pairing may accept (admins too, for support).
  if (user.role !== "admin" && pairing.menteeId !== user.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: plan } = await supabase
    .from("SessionPlan")
    .select("status")
    .eq("pairingId", pairingId)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Rencana sesi belum ada." }, { status: 404 });
  if (plan.status === "draft") {
    return NextResponse.json({ error: "Rencana sesi belum difinalisasi mentor." }, { status: 409 });
  }
  if (plan.status === "acknowledged") {
    return NextResponse.json({ error: "Rencana sesi sudah kamu terima." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("SessionPlan")
    .update({ status: "acknowledged", acknowledgedAt: nowIso, updatedAt: nowIso })
    .eq("pairingId", pairingId)
    .select("id, pairingId, status, rows, finalizedAt, acknowledgedAt, createdAt, updatedAt")
    .single();
  if (error) {
    console.error("[acknowledge] update failed", error);
    return NextResponse.json({ error: "Gagal menerima rencana." }, { status: 500 });
  }

  // Notify the mentor so they know the plan is accepted and sessions unlocked.
  const mentee = pairing.mentee as unknown as { name: string } | null;
  await supabase.from("Notification").insert({
    id: globalThis.crypto.randomUUID(),
    userId: pairing.mentorId,
    title: "Rencana sesi diterima",
    message: `${mentee?.name || "Mentee kamu"} sudah menerima rencana sesi. Sesi siap dijalankan.`,
    type: "session",
    read: false,
    link: `/dashboard/mentee`,
    createdAt: nowIso,
  });

  return NextResponse.json({ plan: updated });
}
