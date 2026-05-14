import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PHOTO_LOCATIONS, type PhotoLocation } from "@/lib/photo-config";
import { LANDING_PHOTO_COLUMNS } from "@/lib/db-columns";

type ConfigRow = {
  mentorId: string;
  location: PhotoLocation;
  photoSrc: string;
  zoom: number;
  posX: number;
  posY: number;
};

/** Public — read every published config for landing-page render. */
export async function GET() {
  const { data, error } = await supabase
    .from("LandingPhotoConfig")
    .select(LANDING_PHOTO_COLUMNS);

  if (error) {
    return NextResponse.json({ configs: [], error: error.message }, { status: 500 });
  }
  return NextResponse.json({ configs: data ?? [] });
}

/** Admin — upsert one or more configs. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  let body: { configs?: ConfigRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const configs = body.configs;
  if (!Array.isArray(configs) || configs.length === 0) {
    return NextResponse.json({ error: "Missing 'configs' array" }, { status: 400 });
  }

  const sanitized = configs.map((c) => {
    if (!c.mentorId || !c.location || !c.photoSrc) {
      throw new Error("mentorId, location, and photoSrc are required");
    }
    if (!PHOTO_LOCATIONS.includes(c.location)) {
      throw new Error(`Invalid location: ${c.location}`);
    }
    return {
      mentorId: c.mentorId,
      location: c.location,
      photoSrc: c.photoSrc,
      zoom: clamp(Number(c.zoom) || 1, 0.5, 4),
      posX: clamp(Number(c.posX) || 0, -200, 200),
      posY: clamp(Number(c.posY) || 0, -200, 200),
      updatedAt: new Date().toISOString(),
      updatedBy: user.userId,
    };
  });

  const { error } = await supabase
    .from("LandingPhotoConfig")
    .upsert(sanitized, { onConflict: "mentorId,location" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: sanitized.length });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
