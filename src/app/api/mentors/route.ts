import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DbMentor } from "@/lib/mentors-runtime";

const SELECT_COLUMNS =
  '"id","fullName","nickname","initials","university","major","country","flagCode","scholarship","color","avatarPath","galleryPaths","hometown","message","achievement","currentStudiesRaw","s1","scholarshipRaw","isActive","displayOrder","source"';

/** Public — landing page reads this on every visit (server + client). */
export async function GET() {
  const { data, error } = await supabase
    .from("Mentor")
    .select(SELECT_COLUMNS)
    .eq("isActive", true)
    .order("displayOrder", { ascending: true });

  if (error) {
    return NextResponse.json({ mentors: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ mentors: data ?? [] });
}

const TRIM_SHORT = 256;
const TRIM_LONG = 4096;

function s(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  return t.slice(0, max);
}

function asArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : null))
    .filter((x): x is string => Boolean(x));
}

/** Admin only — create a new mentor row. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  let body: Partial<DbMentor>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Required fields
  if (!body.id || !body.fullName || !body.nickname || !body.initials || !body.university || !body.major || !body.country) {
    return NextResponse.json(
      { error: "Required: id, fullName, nickname, initials, university, major, country" },
      { status: 400 },
    );
  }

  const row = {
    id: s(body.id, 64)!,
    fullName: s(body.fullName, TRIM_SHORT)!,
    nickname: s(body.nickname, 64)!,
    initials: s(body.initials, 8)!,
    university: s(body.university, TRIM_SHORT)!,
    major: s(body.major, TRIM_SHORT)!,
    country: s(body.country, 64)!,
    flagCode: s(body.flagCode, 8),
    scholarship: s(body.scholarship, TRIM_SHORT),
    color: s(body.color, 64),
    avatarPath: s(body.avatarPath, 512),
    galleryPaths: asArray(body.galleryPaths),
    hometown: s(body.hometown, TRIM_SHORT),
    message: s(body.message, TRIM_LONG),
    achievement: s(body.achievement, TRIM_LONG),
    currentStudiesRaw: s(body.currentStudiesRaw, TRIM_SHORT),
    s1: s(body.s1, TRIM_SHORT),
    scholarshipRaw: s(body.scholarshipRaw, TRIM_LONG),
    isActive: body.isActive ?? true,
    displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 100,
    source: "admin" as const,
    updatedAt: new Date().toISOString(),
    updatedBy: user.userId,
  };

  const { data, error } = await supabase.from("Mentor").insert(row).select(SELECT_COLUMNS).single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `A mentor with id "${row.id}" already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mentor: data }, { status: 201 });
}
