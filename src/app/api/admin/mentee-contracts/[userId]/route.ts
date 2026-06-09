import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  MENTEE_CONTRACT_VERSION,
  MENTEE_IDENTITY_FIELDS,
  menteeIdentityCompleteness,
  type PartialMenteeIdentity,
} from "@/lib/mentee-contract-template";

interface Params {
  params: Promise<{ userId: string }>;
}

/**
 * Phase 18 — GET /api/admin/mentee-contracts/[userId]
 *
 * Returns the full mentee contract record (including signature image +
 * audit trail) plus the mentee's identity. Admin-only.
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
      .from("MenteeContract")
      .select("*")
      .eq("userId", userId)
      .maybeSingle(),
    supabase
      .from("MenteeProfile")
      .select("fullLegalName,placeOfBirth,dateOfBirth,idType,idNumber,legalAddress,phoneNumber")
      .eq("userId", userId)
      .maybeSingle(),
  ]);

  if (userRes.error || !userRes.data) {
    return NextResponse.json({ error: "Mentee tidak ditemukan" }, { status: 404 });
  }
  if (contractRes.error) {
    console.error("Admin mentee-contract detail error:", contractRes.error);
    return NextResponse.json({ error: "Gagal memuat kontrak" }, { status: 500 });
  }
  if (profileRes.error && profileRes.error.code !== "PGRST116") {
    console.error("Admin mentee profile error:", profileRes.error);
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 });
  }

  const profile = profileRes.data;
  const identity: PartialMenteeIdentity = profile
    ? {
        fullName: (profile.fullLegalName as string | null) ?? undefined,
        placeOfBirth: (profile.placeOfBirth as string | null) ?? undefined,
        dateOfBirth: (profile.dateOfBirth as string | null) ?? undefined,
        idType: (profile.idType as string | null) ?? undefined,
        idNumber: (profile.idNumber as string | null) ?? undefined,
        legalAddress: (profile.legalAddress as string | null) ?? undefined,
        phoneNumber: (profile.phoneNumber as string | null) ?? undefined,
      }
    : {};

  return NextResponse.json({
    user: userRes.data,
    contract: contractRes.data ?? null,
    identity,
    identityCompleteness: menteeIdentityCompleteness(identity),
    identityRequired: MENTEE_IDENTITY_FIELDS.length,
    currentVersion: MENTEE_CONTRACT_VERSION,
  });
}

/**
 * Phase 18 — POST /api/admin/mentee-contracts/[userId]
 * Body: { action: "void", reason: string }
 *
 * Voids a signed mentee contract. Same semantics as the mentor variant.
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
    .from("MenteeContract")
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
    console.error("Admin mentee-contract void error:", error);
    return NextResponse.json({ error: "Gagal membatalkan kontrak" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Kontrak tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ contract: data });
}
