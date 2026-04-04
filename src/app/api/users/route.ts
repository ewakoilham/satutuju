import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = req.nextUrl.searchParams.get("role");

  let query = supabase
    .from("User")
    .select("id, email, name, role, createdAt")
    .order("createdAt", { ascending: false });

  if (role) {
    query = query.eq("role", role);
  }

  const { data: users, error } = await query;

  if (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fetch active pairing counts per user
  const { data: activePairings } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("status", "active");

  const activePairingUserIds = new Set<string>();
  for (const p of activePairings || []) {
    if (p.mentorId) activePairingUserIds.add(p.mentorId);
    if (p.menteeId) activePairingUserIds.add(p.menteeId);
  }

  const result = (users || []).map((u) => ({
    ...u,
    hasActivePairing: activePairingUserIds.has(u.id),
  }));

  return NextResponse.json({ users: result });
}
