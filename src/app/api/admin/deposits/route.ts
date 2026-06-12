import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { DEPOSIT_AMOUNT_IDR } from "@/lib/deposit-terms";

/**
 * Phase 19 — GET /api/admin/deposits
 *
 * Returns one row per mentee (User where role='mentee') joined with
 * their MenteeDeposit stub + MenteeContract status (context column).
 * Mirror of /api/admin/mentee-contracts.
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
    console.error("Admin deposits users fetch error:", userErr);
    return NextResponse.json({ error: "Gagal memuat data mentee" }, { status: 500 });
  }

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) {
    return NextResponse.json({ rows: [], amount: DEPOSIT_AMOUNT_IDR });
  }

  const [depositsResult, contractsResult] = await Promise.all([
    supabase
      .from("MenteeDeposit")
      .select(
        "userId,status,amount,proofUploadedAt,verifiedAt,rejectedAt,rejectedReason,rejectionCount,updatedAt",
      )
      .in("userId", userIds),
    supabase
      .from("MenteeContract")
      .select("userId,status")
      .in("userId", userIds),
  ]);
  if (depositsResult.error) {
    console.error("Admin deposits fetch error:", depositsResult.error);
    return NextResponse.json({ error: "Gagal memuat deposit" }, { status: 500 });
  }
  if (contractsResult.error) {
    console.error("Admin deposits contract fetch error:", contractsResult.error);
    return NextResponse.json({ error: "Gagal memuat kontrak" }, { status: 500 });
  }

  const byUserDeposit = new Map(
    (depositsResult.data ?? []).map((d) => [d.userId, d]),
  );
  const byUserContract = new Map(
    (contractsResult.data ?? []).map((c) => [c.userId, c.status as string]),
  );

  const rows = (users ?? []).map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    deposit: byUserDeposit.get(u.id) ?? null,
    contractStatus: byUserContract.get(u.id) ?? null,
  }));

  return NextResponse.json({ rows, amount: DEPOSIT_AMOUNT_IDR });
}
