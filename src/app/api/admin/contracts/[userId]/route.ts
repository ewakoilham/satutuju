import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  CONTRACT_VERSION,
  identityCompleteness,
  IDENTITY_FIELDS,
} from "@/lib/contract-template";

interface Params {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/admin/contracts/[userId]
 *
 * Returns the full contract record (including signature image + audit trail)
 * plus the mentor's identity for one mentor. Admin-only.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await params;

  const [userRes, contractRes, profileRes] = await Promise.all([
    supabase
      .from("User")
      .select("id,name,email,role,createdAt")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("MentorContract")
      .select("*")
      .eq("userId", userId)
      .maybeSingle(),
    supabase
      .from("MentorProfile")
      .select("fullName,placeOfBirth,dateOfBirth,idType,idNumber,npwp,legalAddress,phoneNumber")
      .eq("userId", userId)
      .maybeSingle(),
  ]);

  if (userRes.error || !userRes.data) {
    return NextResponse.json({ error: "Mentor tidak ditemukan" }, { status: 404 });
  }
  if (contractRes.error) {
    console.error("Admin contract detail error:", contractRes.error);
    return NextResponse.json({ error: "Gagal memuat kontrak" }, { status: 500 });
  }
  if (profileRes.error && profileRes.error.code !== "PGRST116") {
    console.error("Admin profile error:", profileRes.error);
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 });
  }

  return NextResponse.json({
    user: userRes.data,
    contract: contractRes.data ?? null,
    identity: profileRes.data ?? {},
    identityCompleteness: identityCompleteness(profileRes.data ?? {}),
    identityRequired: IDENTITY_FIELDS.length,
    currentVersion: CONTRACT_VERSION,
  });
}

/**
 * POST /api/admin/contracts/[userId]
 * Body: { action: "void", reason: string }
 *
 * Voids a signed contract. Preserves the row + PDF + audit trail (sets
 * status=VOID, voidedAt, voidReason). Mentor can re-sign which produces a
 * new contractNumber.
 */
type VoidBody = { action?: string; reason?: string };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await params;

  let body: VoidBody;
  try {
    body = (await req.json()) as VoidBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  if (body.action !== "void") {
    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  }
  const reason = (body.reason ?? "").trim();
  if (reason.length < 5) {
    return NextResponse.json(
      { error: "Alasan pembatalan wajib diisi (minimal 5 karakter)" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("MentorContract")
    .update({
      status: "VOID",
      voidedAt: now,
      voidReason: reason,
      updatedAt: now,
    })
    .eq("userId", userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Admin contract void error:", error);
    return NextResponse.json({ error: "Gagal membatalkan kontrak" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Kontrak tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ contract: data });
}
