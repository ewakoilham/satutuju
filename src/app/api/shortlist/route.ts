import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

/**
 * Mentee university shortlist ("Kampus favorit kamu"), persisted to the
 * mentee's active Pairing.priorityUnis (a JSON array of canonical university
 * names). This is the real, cross-device favorite — and because it lives on
 * the pairing, the mentor sees the same shortlist their mentee built.
 *
 *   GET  → { pairingId, universities: string[] }
 *   PUT  { universities: string[] } → replace the shortlist
 *
 * Mentee-only. The directory UI (/dashboard/universities) calls this for
 * mentees; mentors/admins keep the local wishlist.
 */

async function menteeActivePairing(userId: string) {
  const { data } = await supabase
    .from("Pairing")
    .select("id, priorityUnis, status, createdAt")
    .eq("menteeId", userId)
    .order("createdAt", { ascending: false });
  if (!data || data.length === 0) return null;
  return data.find((p) => p.status === "active") || data[0];
}

function parseList(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee") return NextResponse.json({ pairingId: null, universities: [] });

  const pairing = await menteeActivePairing(user.userId);
  return NextResponse.json({
    pairingId: pairing?.id ?? null,
    universities: parseList(pairing?.priorityUnis),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "mentee") return NextResponse.json({ error: "Mentee only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const universities: string[] = Array.isArray(body?.universities)
    ? body.universities.filter((x: unknown): x is string => typeof x === "string").slice(0, 200)
    : [];

  const pairing = await menteeActivePairing(user.userId);
  if (!pairing) return NextResponse.json({ error: "No active pairing" }, { status: 404 });

  const { error } = await supabase
    .from("Pairing")
    .update({ priorityUnis: JSON.stringify(universities), updatedAt: new Date().toISOString() })
    .eq("id", pairing.id);

  if (error) {
    console.error("[shortlist] save failed", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, universities });
}
