import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

/** Resolve the document + its pairing, and check the caller is allowed to see
 *  it (admin, or the pairing's mentor/mentee). Returns null on no-access. */
async function authorizeDoc(documentId: string, userId: string, role: string) {
  const { data: doc } = await supabase
    .from("Document")
    .select("id, name, pairingId")
    .eq("id", documentId)
    .single();
  if (!doc) return null;
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", doc.pairingId)
    .single();
  if (!pairing) return null;
  const allowed = role === "admin" || userId === pairing.mentorId || userId === pairing.menteeId;
  if (!allowed) return null;
  return { doc, pairing };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ctx = await authorizeDoc(id, user.userId, user.role);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: comments } = await supabase
    .from("DocumentComment")
    .select("*, author:User!authorId(id, name, role)")
    .eq("documentId", id)
    .order("createdAt", { ascending: true });

  return NextResponse.json({ comments: comments || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ctx = await authorizeDoc(id, user.userId, user.role);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const suggestedQuote = typeof body?.suggestedQuote === "string" && body.suggestedQuote.trim()
    ? body.suggestedQuote.trim()
    : null;
  if (!text) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  const now = new Date().toISOString();
  const { data: comment, error } = await supabase
    .from("DocumentComment")
    .insert({ id: generateId(), documentId: id, authorId: user.userId, body: text, suggestedQuote, createdAt: now })
    .select("*, author:User!authorId(id, name, role)")
    .single();

  if (error) {
    console.error("[doc comment] insert failed", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Notify the other party in the pairing.
  const otherId = user.userId === ctx.pairing.mentorId ? ctx.pairing.menteeId : ctx.pairing.mentorId;
  if (otherId) {
    await supabase.from("Notification").insert({
      id: generateId(),
      userId: otherId,
      title: "Catatan dokumen baru",
      message: `${user.name || "Seseorang"} menambahkan catatan pada "${ctx.doc.name}".`,
      type: "document",
      read: false,
      link: `/dashboard/dokumen`,
      createdAt: now,
    }).then(() => {}, () => {});
  }

  return NextResponse.json({ comment }, { status: 201 });
}
