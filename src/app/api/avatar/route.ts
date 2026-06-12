import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { sniffImage } from "@/lib/image-sniff";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

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
