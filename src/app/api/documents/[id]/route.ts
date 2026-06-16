import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Find the document
  const { data: doc, error: docError } = await supabase
    .from("Document")
    .select("*")
    .eq("id", id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Find its pairing separately (avoids FK join issues)
  const { data: docPairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", doc.pairingId)
    .single();

  // Only the pairing's mentor or an admin may review (approve / request
  // revision / set status / leave the legacy feedback note). The mentee can't
  // approve their own documents.
  const canReview = user.role === "admin" || (docPairing && user.userId === docPairing.mentorId);
  if (!canReview) {
    return NextResponse.json({ error: "Hanya mentor atau admin yang bisa meninjau dokumen." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("Document")
    .update({
      status: body.status ?? doc.status,
      feedback: body.feedback ?? doc.feedback,
      updatedAt: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Document update error:", updateError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Notify mentee when mentor or admin reviews
  if (body.status && docPairing) {
    const statusLabel =
      body.status === "approved"
        ? "approved"
        : body.status === "needs_revision"
        ? "needs revision"
        : body.status;
    await supabase.from("Notification").insert({
      id: generateId(),
      userId: docPairing.menteeId,
      title: "Document Review Update",
      message: `Your document "${doc.name}" has been marked as ${statusLabel}.`,
      type: "document",
      read: false,
      link: `/dashboard/pairings/${doc.pairingId}`,
      createdAt: now,
    });
  }

  return NextResponse.json({ document: updated });
}

// ── DELETE: Remove a document ──
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Find the document
  const { data: doc, error: docError } = await supabase
    .from("Document")
    .select("*")
    .eq("id", id)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Access check: admin, mentor of the pairing, or the uploader
  if (user.role !== "admin" && user.userId !== doc.uploadedBy) {
    // Also allow mentor of the pairing
    const { data: delPairing } = await supabase
      .from("Pairing")
      .select("mentorId")
      .eq("id", doc.pairingId)
      .single();
    if (!delPairing || user.userId !== delPairing.mentorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Delete from Supabase Storage if it's a storage URL
  if (doc.filePath && doc.filePath.includes("supabase")) {
    // Extract the storage path from the URL
    const match = doc.filePath.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
    if (match) {
      await supabase.storage.from("documents").remove([match[1]]);
    }
  }

  // Delete from DB
  const { error: deleteError } = await supabase
    .from("Document")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Document delete error:", deleteError);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
