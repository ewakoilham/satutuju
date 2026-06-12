import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

interface Params {
  params: Promise<{ userId: string }>;
}

/**
 * Phase 19 — admin verification of a mentee's deposit proof.
 *
 *   GET  → full MenteeDeposit row + user + contract status
 *   POST → { action: "verify" } or { action: "reject", reason }
 *
 * Verify/reject always notify the mentee directly (no dedup — explicit
 * admin actions should always reach the bell). A reject closes the
 * mentee's hard gate again until they re-upload.
 */

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await params;

  const [userRes, depositRes, contractRes] = await Promise.all([
    supabase
      .from("User")
      .select("id,name,email,role,createdAt")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("MenteeDeposit")
      .select("*")
      .eq("userId", userId)
      .maybeSingle(),
    supabase
      .from("MenteeContract")
      .select("status")
      .eq("userId", userId)
      .maybeSingle(),
  ]);

  if (userRes.error || !userRes.data) {
    return NextResponse.json({ error: "Mentee tidak ditemukan" }, { status: 404 });
  }
  if (depositRes.error) {
    console.error("Admin deposit detail error:", depositRes.error);
    return NextResponse.json({ error: "Gagal memuat deposit" }, { status: 500 });
  }

  return NextResponse.json({
    user: userRes.data,
    deposit: depositRes.data ?? null,
    contractStatus: (contractRes.data?.status as string | undefined) ?? null,
  });
}

type ActionBody = { action?: string; reason?: string };

async function notifyMentee(
  userId: string,
  title: string,
  message: string,
  type: "info" | "alert",
) {
  const { error } = await supabase.from("Notification").insert({
    id: crypto.randomUUID(),
    userId,
    title,
    message,
    type,
    link: "/dashboard/deposit",
    read: false,
    createdAt: new Date().toISOString(),
  });
  if (error) {
    console.warn("[admin-deposits] notification insert failed:", error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await params;

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("MenteeDeposit")
    .select("*")
    .eq("userId", userId)
    .maybeSingle();
  if (fetchErr) {
    console.error("Admin deposit action fetch error:", fetchErr);
    return NextResponse.json({ error: "Gagal memuat deposit" }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Deposit tidak ditemukan" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const history = (existing.history as Array<Record<string, unknown>> | null) ?? [];

  if (body.action === "verify") {
    if (existing.status !== "UPLOADED") {
      return NextResponse.json(
        { error: "Hanya bukti berstatus 'Menunggu verifikasi' yang dapat diverifikasi" },
        { status: 409 },
      );
    }
    const { data, error } = await supabase
      .from("MenteeDeposit")
      .update({
        status: "VERIFIED",
        verifiedAt: now,
        verifiedBy: user.userId,
        rejectedAt: null,
        rejectedReason: null,
        history: [...history, { action: "verify", at: now, by: user.userId }],
        updatedAt: now,
      })
      .eq("userId", userId)
      .select()
      .single();
    if (error) {
      console.error("Admin deposit verify error:", error);
      return NextResponse.json({ error: "Gagal memverifikasi deposit" }, { status: 500 });
    }
    await notifyMentee(
      userId,
      "Deposit terverifikasi",
      "Bukti transfer deposit Anda telah diverifikasi oleh admin. Terima kasih!",
      "info",
    );
    return NextResponse.json({ deposit: data });
  }

  if (body.action === "reject") {
    if (existing.status !== "UPLOADED" && existing.status !== "VERIFIED") {
      return NextResponse.json(
        { error: "Tidak ada bukti yang dapat ditolak" },
        { status: 409 },
      );
    }
    const reason = (body.reason ?? "").trim();
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Alasan penolakan wajib diisi (minimal 5 karakter)" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("MenteeDeposit")
      .update({
        status: "REJECTED",
        rejectedAt: now,
        rejectedReason: reason,
        rejectionCount: ((existing.rejectionCount as number) ?? 0) + 1,
        verifiedAt: null,
        verifiedBy: null,
        history: [...history, { action: "reject", at: now, by: user.userId, reason }],
        updatedAt: now,
      })
      .eq("userId", userId)
      .select()
      .single();
    if (error) {
      console.error("Admin deposit reject error:", error);
      return NextResponse.json({ error: "Gagal menolak bukti" }, { status: 500 });
    }
    await notifyMentee(
      userId,
      "Bukti deposit ditolak",
      `Bukti transfer deposit Anda ditolak: ${reason}. Mohon unggah ulang bukti yang valid — akses dashboard Anda ditangguhkan hingga bukti baru diunggah.`,
      "alert",
    );
    return NextResponse.json({ deposit: data });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
}
