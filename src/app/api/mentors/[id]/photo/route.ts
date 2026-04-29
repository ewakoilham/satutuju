import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const BUCKET = "mentor-photos";
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB — landing-page hero photos can be largeish
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Admin only — upload a single photo for the given mentor and return its
 * public URL. The caller decides whether to store it as the primary
 * `avatarPath` or push it onto `galleryPaths` via the PUT /api/mentors/[id]
 * endpoint.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin")
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid mentor id" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size must be under 8 MB" },
      { status: 400 },
    );
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  // Each photo gets a unique key so updates don't clobber the existing image
  // while a CDN cache is still serving it.
  const storagePath = `${id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Mentor photo upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 },
    );
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return NextResponse.json({ url: urlData.publicUrl, storagePath });
}
