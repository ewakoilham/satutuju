import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Row = { mentorId: string; nickname: string | null };

/** Public — every visitor reads the published nickname overrides. */
export async function GET() {
  const { data, error } = await supabase
    .from("MentorOverride")
    .select("mentorId, nickname");
  if (error) {
    return NextResponse.json({ overrides: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ overrides: data ?? [] });
}

/** Admin — upsert one or more overrides. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: { overrides?: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const overrides = body.overrides;
  if (!Array.isArray(overrides) || overrides.length === 0) {
    return NextResponse.json({ error: "Missing 'overrides' array" }, { status: 400 });
  }

  const sanitized = overrides.map((o) => {
    if (!o.mentorId) throw new Error("mentorId is required");
    return {
      mentorId: o.mentorId,
      nickname: o.nickname ? String(o.nickname).trim().slice(0, 64) : null,
      updatedAt: new Date().toISOString(),
      updatedBy: user.userId,
    };
  });

  const { error } = await supabase
    .from("MentorOverride")
    .upsert(sanitized, { onConflict: "mentorId" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: sanitized.length });
}
