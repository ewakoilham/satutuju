/** POST /api/escalations
 *
 *  Mentor flags a mentee for admin attention. We don't have a dedicated
 *  Escalation table — admins consume escalations as a high-priority
 *  Notification row, distinguished by `type: "escalation"`. Future work
 *  can add a status/ack flow on top.
 *
 *  Body: { pairingId: string, reason: string, context?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_REASONS = new Set([
  "Tidak bisa dihubungi",
  "Lewat 2 sesi berturut-turut",
  "Konflik schedule mentor",
  "Lainnya",
]);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentor" && user.role !== "admin") {
    return NextResponse.json({ error: "Hanya mentor yang bisa mengeskalasi." }, { status: 403 });
  }

  const body = await req.json();
  const pairingId = String(body.pairingId || "");
  const reason = String(body.reason || "");
  const context = body.context ? String(body.context).slice(0, 1000) : "";

  if (!pairingId) return NextResponse.json({ error: "pairingId wajib." }, { status: 400 });
  if (!ALLOWED_REASONS.has(reason)) return NextResponse.json({ error: "Alasan tidak valid." }, { status: 400 });

  // Verify the caller is the mentor on this pairing (admins can escalate for anyone).
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, mentorId, menteeId, mentee:User!menteeId(name)")
    .eq("id", pairingId)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ error: "Pairing tidak ditemukan." }, { status: 404 });
  if (user.role !== "admin" && pairing.mentorId !== user.userId) {
    return NextResponse.json({ error: "Bukan mentee kamu." }, { status: 403 });
  }

  const mentee = pairing.mentee as unknown as { name: string } | null;
  const menteeName = mentee?.name ?? "Mentee";

  // Find all admins to notify.
  const { data: admins } = await supabase.from("User").select("id").eq("role", "admin");
  if (!admins?.length) {
    return NextResponse.json({ error: "Tidak ada admin yang aktif. Hubungi langsung tim Satu Tuju." }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const summary = context ? `${reason} — ${context.slice(0, 120)}` : reason;
  const rows = admins.map((a) => ({
    id: globalThis.crypto.randomUUID(),
    userId: a.id,
    title: `⚠ Eskalasi: ${menteeName}`,
    message: `${user.name} mengeskalasi mentee ${menteeName}. Alasan: ${summary}`,
    type: "escalation",
    read: false,
    link: `/dashboard/pairings/${pairingId}`,
    createdAt: nowIso,
  }));

  const { error } = await supabase.from("Notification").insert(rows);
  if (error) {
    console.error("[escalations] insert failed", error);
    return NextResponse.json({ error: "Gagal mengirim eskalasi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notifiedAdmins: admins.length });
}
