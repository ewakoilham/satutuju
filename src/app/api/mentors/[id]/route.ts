import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { DbMentor } from "@/lib/mentors-runtime";

const SELECT_COLUMNS =
  '"id","fullName","nickname","initials","university","major","country","flagCode","scholarship","color","avatarPath","galleryPaths","hometown","message","achievement","currentStudiesRaw","s1","scholarshipRaw","isActive","displayOrder","source"';

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

/** Admin only — update one mentor by id. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: Partial<DbMentor>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Build patch with only fields that were provided.
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: user.userId,
  };
  const setIfPresent = (key: keyof DbMentor, sanitized: unknown) => {
    if (key in body) patch[key] = sanitized;
  };
  setIfPresent("fullName", s(body.fullName, TRIM_SHORT));
  setIfPresent("nickname", s(body.nickname, 64));
  setIfPresent("initials", s(body.initials, 8));
  setIfPresent("university", s(body.university, TRIM_SHORT));
  setIfPresent("major", s(body.major, TRIM_SHORT));
  setIfPresent("country", s(body.country, 64));
  setIfPresent("flagCode", s(body.flagCode, 8));
  setIfPresent("scholarship", s(body.scholarship, TRIM_SHORT));
  setIfPresent("color", s(body.color, 64));
  setIfPresent("avatarPath", s(body.avatarPath, 512));
  if ("galleryPaths" in body) patch.galleryPaths = asArray(body.galleryPaths);
  setIfPresent("hometown", s(body.hometown, TRIM_SHORT));
  setIfPresent("message", s(body.message, TRIM_LONG));
  setIfPresent("achievement", s(body.achievement, TRIM_LONG));
  setIfPresent("currentStudiesRaw", s(body.currentStudiesRaw, TRIM_SHORT));
  setIfPresent("s1", s(body.s1, TRIM_SHORT));
  setIfPresent("scholarshipRaw", s(body.scholarshipRaw, TRIM_LONG));
  if ("isActive" in body) patch.isActive = Boolean(body.isActive);
  if ("displayOrder" in body && typeof body.displayOrder === "number") {
    patch.displayOrder = body.displayOrder;
  }

  const { data, error } = await supabase
    .from("Mentor")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mentor: data });
}

/** Admin only — soft-delete (set isActive = false). Pass ?hard=true to force-remove. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  if (hard) {
    const { error } = await supabase.from("Mentor").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: id });
  }

  const { error } = await supabase
    .from("Mentor")
    .update({ isActive: false, updatedAt: new Date().toISOString(), updatedBy: user.userId })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deactivated: id });
}
