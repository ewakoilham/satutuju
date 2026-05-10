import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { identityCompleteness, IDENTITY_FIELDS } from "@/lib/contract-template";

/**
 * GET /api/admin/contracts
 *
 * Returns one row per mentor (User where role='mentor') joined with their
 * MentorContract (or null) and a derived `identityCompleteness` count.
 * Admin-only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. All mentor users.
  const { data: users, error: userErr } = await supabase
    .from("User")
    .select("id,name,email,createdAt")
    .eq("role", "mentor")
    .order("createdAt", { ascending: true });
  if (userErr) {
    console.error("Admin contracts users fetch error:", userErr);
    return NextResponse.json({ error: "Gagal memuat data mentor" }, { status: 500 });
  }

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  // 2. Joined contract + identity in two parallel calls (no RLS join here).
  const [contractsResult, profilesResult] = await Promise.all([
    supabase
      .from("MentorContract")
      .select(
        "userId,contractNumber,status,signedAt,signatureHash,createdAt,voidedAt,voidReason,pdfPath",
      )
      .in("userId", userIds),
    supabase
      .from("MentorProfile")
      .select("userId,fullName,placeOfBirth,dateOfBirth,idType,idNumber,npwp,legalAddress,phoneNumber")
      .in("userId", userIds),
  ]);
  if (contractsResult.error) {
    console.error("Admin contracts contract fetch error:", contractsResult.error);
    return NextResponse.json({ error: "Gagal memuat kontrak" }, { status: 500 });
  }
  if (profilesResult.error) {
    console.error("Admin contracts profile fetch error:", profilesResult.error);
    return NextResponse.json({ error: "Gagal memuat profil" }, { status: 500 });
  }

  const byUserContract = new Map(
    (contractsResult.data ?? []).map((c) => [c.userId, c]),
  );
  const byUserProfile = new Map(
    (profilesResult.data ?? []).map((p) => [p.userId, p]),
  );

  const rows = (users ?? []).map((u) => {
    const profile = byUserProfile.get(u.id) ?? {};
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      contract: byUserContract.get(u.id) ?? null,
      identityCompleteness: identityCompleteness(profile),
      identityRequired: IDENTITY_FIELDS.length,
    };
  });

  return NextResponse.json({ rows });
}
