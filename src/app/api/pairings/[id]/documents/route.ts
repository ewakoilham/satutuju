import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const documents = await prisma.document.findMany({
    where: { pairingId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const category = formData.get("category") as string;
  const name = formData.get("name") as string;

  if (!file || !category || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${Date.now()}-${file.name}`;
  const storagePath = `${id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Check if there's an existing doc of same category to increment version
  const existing = await prisma.document.findFirst({
    where: { pairingId: id, category },
    orderBy: { version: "desc" },
  });

  const doc = await prisma.document.create({
    data: {
      pairingId: id,
      category,
      name,
      fileName,
      filePath: urlData.publicUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.userId,
      version: existing ? existing.version + 1 : 1,
    },
  });

  // Notify the other party
  const pairing = await prisma.pairing.findUnique({ where: { id } });
  if (pairing) {
    const notifyUserId =
      user.userId === pairing.menteeId ? pairing.mentorId : pairing.menteeId;
    await prisma.notification.create({
      data: {
        userId: notifyUserId,
        title: "New Document Uploaded",
        message: `A new document was uploaded: "${name}"`,
        type: "document",
        link: `/dashboard/pairings/${id}`,
      },
    });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
