import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { getPairingDetail } from "@/lib/pairing-detail";

/**
 * The current mentee's active pairing, fully detailed, in ONE request.
 * Lets mentee pages (Beranda, Dokumen) skip the old list→detail waterfall
 * (fetch /api/pairings, then /api/pairings/[id]) — the pairing id is resolved
 * server-side. Returns { pairing: null } when the mentee has no pairing.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("Pairing")
    .select("id, status, createdAt")
    .eq("menteeId", user.userId)
    .order("createdAt", { ascending: false });

  const pick = (rows || []).find((p) => p.status === "active") || (rows || [])[0];
  if (!pick) return NextResponse.json({ pairing: null });

  const pairing = await getPairingDetail(pick.id as string);
  return NextResponse.json({ pairing });
}
