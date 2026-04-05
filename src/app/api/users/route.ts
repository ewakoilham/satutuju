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

  // Fetch mentor profile completeness (check key required fields)
  const mentorIds = (users || []).filter((u) => u.role === "mentor").map((u) => u.id);
  const mentorProfileMap = new Map<string, boolean>();
  if (mentorIds.length > 0) {
    const { data: mentorProfiles } = await supabase
      .from("MentorProfile")
      .select("userId, fullName, city, undergradUniversity, postgradUniversity, fundingScheme, currentField, weeklyHours, availability, personality, mentorStyle, workStyle, communicationStyle, primaryRoles")
      .in("userId", mentorIds);

    const REQUIRED_FIELDS = [
      "fullName", "city", "undergradUniversity", "postgradUniversity",
      "fundingScheme", "currentField", "weeklyHours", "availability",
      "personality", "mentorStyle", "workStyle", "communicationStyle", "primaryRoles",
    ] as const;

    for (const mp of mentorProfiles || []) {
      const complete = REQUIRED_FIELDS.every((f) => {
        const v = mp[f as keyof typeof mp];
        if (Array.isArray(v)) return v.length > 0;
        return v !== null && v !== undefined && v !== "";
      });
      mentorProfileMap.set(mp.userId, complete);
    }
  }

  const result = (users || []).map((u) => ({
    ...u,
    hasActivePairing: activePairingUserIds.has(u.id),
    mentorProfileComplete: u.role === "mentor" ? (mentorProfileMap.get(u.id) ?? false) : undefined,
  }));

  return NextResponse.json({ users: result });
}
