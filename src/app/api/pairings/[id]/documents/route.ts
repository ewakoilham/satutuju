import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: documents, error } = await supabase
    .from("Document")
    .select("*")
    .eq("pairingId", id)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Documents fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ documents: documents || [] });
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
  const { data: existing } = await supabase
    .from("Document")
    .select("version")
    .eq("pairingId", id)
    .eq("category", category)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const now = new Date().toISOString();
  const { data: doc, error: docError } = await supabase
    .from("Document")
    .insert({
      id: generateId(),
      pairingId: id,
      category,
      name,
      fileName,
      filePath: urlData.publicUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.userId,
      version: existing ? existing.version + 1 : 1,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (docError || !doc) {
    console.error("Document create error:", docError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Notify the other party
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", id)
    .single();

  if (pairing) {
    const notifyUserId =
      user.userId === pairing.menteeId ? pairing.mentorId : pairing.menteeId;
    await supabase.from("Notification").insert({
      id: generateId(),
      userId: notifyUserId,
      title: "New Document Uploaded",
      message: `A new document was uploaded: "${name}"`,
      type: "document",
      read: false,
      link: `/dashboard/pairings/${id}`,
      createdAt: now,
    });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
