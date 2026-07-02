import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { sniffDocument, sanitizeBaseName } from "@/lib/doc-sniff";

function generateId(): string {
  return crypto.randomUUID();
}

/** 10 MB — transcripts/ijazah scans run large; anything bigger is suspect. */
const MAX_SIZE = 10 * 1024 * 1024;

/** Only the pairing's mentor, its mentee, or an admin may touch its documents. */
async function canAccessPairing(
  user: { userId: string; role: string },
  pairingId: string,
): Promise<boolean> {
  if (user.role === "admin") return true;
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", pairingId)
    .single();
  if (!pairing) return false;
  return user.userId === pairing.mentorId || user.userId === pairing.menteeId;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canAccessPairing(user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const sessionNumRaw = formData.get("sessionNum");
  const sessionNum =
    sessionNumRaw != null && sessionNumRaw !== "" ? Number(sessionNumRaw) : null;

  if (!file || !category || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!(await canAccessPairing(user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File terlalu besar — maksimum 10 MB." },
      { status: 400 },
    );
  }

  // Validate the REAL file type from magic bytes (never the client-supplied
  // file.type/file.name — both attacker-controlled). Allowed: PDF, Office
  // docs, images, plain text. The sniffed contentType is also what Supabase
  // serves the file back with, so HTML/SVG/scripts can't be smuggled in and
  // rendered from our public bucket.
  const bytes = await file.arrayBuffer();
  const sniffed = sniffDocument(new Uint8Array(bytes));
  if (!sniffed) {
    return NextResponse.json(
      { error: "Tipe file tidak didukung. Gunakan PDF, Word, gambar, atau teks." },
      { status: 400 },
    );
  }

  // Upload to Supabase Storage under a sanitized key (client filename may
  // contain path separators or unsafe characters).
  const buffer = Buffer.from(bytes);
  const fileName = `${Date.now()}-${sanitizeBaseName(file.name)}.${sniffed.ext}`;
  const storagePath = `${id}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: sniffed.contentType,
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

  // Check if there's an existing doc of same name to increment version
  const { data: existing } = await supabase
    .from("Document")
    .select("version")
    .eq("pairingId", id)
    .eq("name", name)
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
      mimeType: sniffed.contentType,
      sessionNum,
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
