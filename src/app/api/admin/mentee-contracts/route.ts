import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  MENTEE_CONTRACT_VERSION,
  MENTEE_IDENTITY_FIELDS,
  menteeIdentityCompleteness,
  type PartialMenteeIdentity,
} from "@/lib/mentee-contract-template";

/**
 * Phase 18 — GET /api/admin/mentee-contracts
 *
 * Returns one row per mentee (User where role='mentee') joined with
 * their MenteeContract + identity completeness. Mirror of the mentor
 * admin endpoint.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: users, error: userErr } = await supabase
    .from("User")
    .select("id,name,email,createdAt")
    .eq("role", "mentee")
    .order("createdAt", { ascending: true });
  if (userErr) {
    console.error("Admin mentee-contracts users fetch error:", userErr);
    return NextResponse.json({ error: "Gagal memuat data mentee" }, { status: 500 });
  }

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) {
    return NextResponse.json({ rows: [], currentVersion: MENTEE_CONTRACT_VERSION });
  }

  const [contractsResult, profilesResult] = await Promise.all([
    supabase
      .from("MenteeContract")
      .select(
        "userId,contractNumber,status,templateVersion,signedAt,signatureHash,createdAt,updatedAt,voidedAt,voidReason,pdfPath",
      )
      .in("userId", userIds),
    supabase
      .from("MenteeProfile")
      .select("userId,fullLegalName,placeOfBirth,dateOfBirth,idType,idNumber,legalAddress,phoneNumber")
      .in("userId", userIds),
  ]);
  if (contractsResult.error) {
    console.error("Admin mentee-contracts contract fetch error:", contractsResult.error);
    return NextResponse.json({ error: "Gagal memuat kontrak" }, { status: 500 });
  }
  if (profilesResult.error) {
    console.error("Admin mentee-contracts profile fetch error:", profilesResult.error);
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 });
  }

  const byUserContract = new Map(
    (contractsResult.data ?? []).map((c) => [c.userId, c]),
  );
  const byUserProfile = new Map(
    (profilesResult.data ?? []).map((p) => [p.userId, p]),
  );

  const rows = (users ?? []).map((u) => {
    const profile = byUserProfile.get(u.id);
    // Remap fullLegalName → fullName for completeness check (matches
    // MenteeIdentitySnapshot.fullName key).
    const remapped: PartialMenteeIdentity = profile
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
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      contract: byUserContract.get(u.id) ?? null,
      identityCompleteness: menteeIdentityCompleteness(remapped),
      identityRequired: MENTEE_IDENTITY_FIELDS.length,
    };
  });

  return NextResponse.json({ rows, currentVersion: MENTEE_CONTRACT_VERSION });
}
