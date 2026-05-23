import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { LEAD_NOTE_COLUMNS, MENTOR_LEAD_SELECT_COLUMNS } from "@/lib/db-columns";
import { requireMentor } from "@/lib/leads/auth-guards";
import type { LeadNote, LeadNoteThread } from "@/lib/leads/types";

/**
 * GET /api/mentor/leads/[id] — single lead detail for the mentor view.
 *
 * Returns:
 *   • lead       (safe columns only)
 *   • flaggedByMe + flagContext
 *   • notes: thread of the mentor's own top-level notes with all admin
 *            replies attached. Other mentors' notes are NOT exposed.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMentor();
  if (guard.error) return guard.error;
  const mentor = guard.user;

  const { id } = await params;

  const { data: lead, error: leadErr } = await supabase
    .from("Lead")
    .select(MENTOR_LEAD_SELECT_COLUMNS)
    .eq("id", id)
    .single();
  if (leadErr) {
    const code = leadErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: leadErr.message }, { status: code });
  }

  // Mentor's own flag (if any) — includes the optional context.
  const { data: flagRow } = await supabase
    .from("MentorLeadFlag")
    .select("id, context")
    .eq("leadId", id)
    .eq("mentorId", mentor.userId)
    .maybeSingle();

  // Mentor's own top-level notes, plus ALL replies that reference them
  // (admin replies + any future mentor follow-ups). Two queries +
  // in-memory stitch keeps the wire shape simple.
  const { data: topLevel } = await supabase
    .from("LeadNote")
    .select(LEAD_NOTE_COLUMNS)
    .eq("leadId", id)
    .eq("authorId", mentor.userId)
    .is("parentNoteId", null)
    .order("createdAt", { ascending: false });

  const topIds = (topLevel ?? []).map((n) => n.id as string);
  const replyRows = topIds.length
    ? (await supabase
        .from("LeadNote")
        .select(LEAD_NOTE_COLUMNS)
        .in("parentNoteId", topIds)
        .order("createdAt", { ascending: true })).data ?? []
    : [];

  // Hydrate author name/role via a single User lookup.
  const authorIds = Array.from(
    new Set([
      ...(topLevel ?? []).map((n) => n.authorId as string),
      ...replyRows.map((n) => n.authorId as string),
    ]),
  );
  const { data: authors } = authorIds.length
    ? await supabase.from("User").select("id, name, role").in("id", authorIds)
    : { data: [] as { id: string; name: string; role: string }[] };
  const authorMap = new Map(
    (authors ?? []).map((a) => [a.id as string, { name: a.name as string, role: a.role as string }]),
  );

  function decorate(n: LeadNote): LeadNoteThread {
    const meta = authorMap.get(n.authorId);
    return {
      ...n,
      authorName: meta?.name ?? "—",
      authorRole: meta?.role ?? "—",
      replies: [],
    };
  }
  const thread: LeadNoteThread[] = (topLevel ?? []).map((parent) => {
    const decorated = decorate(parent as LeadNote);
    decorated.replies = replyRows
      .filter((r) => r.parentNoteId === parent.id)
      .map((r) => decorate(r as LeadNote));
    return decorated;
  });

  return NextResponse.json({
    lead,
    flaggedByMe: !!flagRow,
    flagContext: flagRow?.context ?? null,
    notes: thread,
  });
}
