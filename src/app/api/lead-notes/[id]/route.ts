import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { LEAD_NOTE_COLUMNS } from "@/lib/db-columns";
import { requireAdminOrMentor } from "@/lib/leads/auth-guards";
import { LEAD_NOTE_EDIT_WINDOW_MS } from "@/lib/leads/types";

/**
 * PATCH /api/lead-notes/[id] — edit a note's content within the
 * 15-minute window (LEAD_NOTE_EDIT_WINDOW_MS). Author-only. Sets
 * editedAt = now() so the UI can show a "(diedit)" marker.
 *
 * No DELETE endpoint by design (Phase 13 plan).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminOrMentor();
  if (guard.error) return guard.error;
  const user = guard.user;

  const { id } = await params;
  let body: { content?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "content too long (max 4000)" }, { status: 400 });
  }

  const { data: existing, error: lookupErr } = await supabase
    .from("LeadNote")
    .select('id, "authorId", "createdAt"')
    .eq("id", id)
    .single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }
  if (existing.authorId !== user.userId) {
    return NextResponse.json({ error: "Only the author can edit this note" }, { status: 403 });
  }
  const createdAtMs = new Date(existing.createdAt as string).getTime();
  if (Date.now() - createdAtMs > LEAD_NOTE_EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edit window expired (15 menit)" },
      { status: 403 },
    );
  }

  const { data: updated, error: updErr } = await supabase
    .from("LeadNote")
    .update({ content, editedAt: new Date().toISOString() })
    .eq("id", id)
    .select(LEAD_NOTE_COLUMNS)
    .single();
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ note: updated });
}
