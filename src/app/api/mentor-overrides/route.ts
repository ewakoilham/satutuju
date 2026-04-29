import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Row = {
  mentorId: string;
  nickname?: string | null;
  message?: string | null;
  achievement?: string | null;
  currentStudies?: string | null;
  s1?: string | null;
  scholarship?: string | null;
};

const SELECT_COLUMNS = "mentorId, nickname, message, achievement, currentStudies, s1, scholarship";

/** Public — every visitor reads the published overrides (nickname + bio content). */
export async function GET() {
  const { data, error } = await supabase
    .from("MentorOverride")
    .select(SELECT_COLUMNS);
  if (error) {
    // Fail soft — if the bio-content columns aren't migrated yet, fall back
    // to nickname-only so the page still renders.
    const fallback = await supabase.from("MentorOverride").select("mentorId, nickname");
    if (fallback.error) {
      return NextResponse.json({ overrides: [], error: error.message }, { status: 500 });
    }
    return NextResponse.json({ overrides: fallback.data ?? [] });
  }
  return NextResponse.json({ overrides: data ?? [] });
}

const TRIM_LIMIT_SHORT = 256;
const TRIM_LIMIT_LONG = 4096;

function sanitizeField(v: unknown, maxLen: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

/** Admin only — upsert one or more overrides (nickname + bio fields). */
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
      nickname: sanitizeField(o.nickname, 64),
      message: sanitizeField(o.message, TRIM_LIMIT_LONG),
      achievement: sanitizeField(o.achievement, TRIM_LIMIT_LONG),
      currentStudies: sanitizeField(o.currentStudies, TRIM_LIMIT_SHORT),
      s1: sanitizeField(o.s1, TRIM_LIMIT_SHORT),
      scholarship: sanitizeField(o.scholarship, TRIM_LIMIT_LONG),
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
