import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Sniff the real image type from the file's magic bytes. Returns the
 * canonical content-type + extension, or null if the bytes are not one of
 * the allowed image formats. This does NOT trust the client-supplied
 * `file.type` / `file.name`, which are both attacker-controlled.
 */
function sniffImage(bytes: Uint8Array): { contentType: string; ext: string } | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: "png" };
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File size must be under 2 MB" },
      { status: 400 }
    );
  }

  // Verify the actual file contents — not the client-supplied MIME/name.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 }
    );
  }

  // Storage path + content-type come from the verified bytes, so a
  // spoofed filename/extension can't control either.
  const storagePath = `${user.userId}.${sniffed.ext}`;

  // Upload to Supabase Storage (upsert to replace existing)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      upsert: true,
      contentType: sniffed.contentType,
    });

  if (uploadError) {
    console.error("Avatar upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 }
    );
  }

  // Build public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Update user record
  const { error: dbError } = await supabase
    .from("User")
    .update({ avatar: avatarUrl })
    .eq("id", user.userId);

  if (dbError) {
    console.error("Avatar DB update error:", dbError);
    return NextResponse.json(
      { error: "Failed to save avatar" },
      { status: 500 }
    );
  }

  return NextResponse.json({ avatar: avatarUrl });
}
