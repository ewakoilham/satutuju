import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { LEAD_NOTE_COLUMNS } from "@/lib/db-columns";
import { requireAdminOrMentor } from "@/lib/leads/auth-guards";
import { notifyAllAdmins, notifyOne } from "@/lib/leads/notification-helpers";

/**
 * POST /api/lead-notes — create a note on a lead.
 *
 * Threading invariants enforced server-side:
 *   • Top-level (parentNoteId omitted/null) → author must be mentor.
 *   • Reply (parentNoteId set) → author must be admin AND parent must
 *     itself be top-level (no reply-of-reply).
 *
 * Fires notifications:
 *   • mentor top-level note  → all admins
 *   • admin reply            → original mentor (the parent's author)
 *
 * Body: { leadId: string, parentNoteId?: string|null, content: string }
 */

function noteId(): string {
  return "ln_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminOrMentor();
  if (guard.error) return guard.error;
  const user = guard.user;

  let body: { leadId?: unknown; parentNoteId?: unknown; content?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const parentNoteId = typeof body.parentNoteId === "string" && body.parentNoteId
    ? body.parentNoteId
    : null;
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  if (content.length > 4000) {
    return NextResponse.json({ error: "content too long (max 4000)" }, { status: 400 });
  }

  // Verify lead exists + fetch name for the notification message.
  const { data: lead, error: leadErr } = await supabase
    .from("Lead")
    .select("id, name")
    .eq("id", leadId)
    .single();
  if (leadErr) {
    const code = leadErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: leadErr.message }, { status: code });
  }

  // Threading invariant.
  let parentAuthorId: string | null = null;
  if (parentNoteId === null) {
    // Top-level → mentor only.
    if (user.role !== "mentor") {
      return NextResponse.json(
        { error: "Top-level notes are mentor-only (admins reply to mentor notes)" },
        { status: 403 },
      );
    }
  } else {
    // Reply → admin only, and parent must be top-level.
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can reply" }, { status: 403 });
    }
    const { data: parent, error: parentErr } = await supabase
      .from("LeadNote")
      .select('id, "leadId", "authorId", "parentNoteId"')
      .eq("id", parentNoteId)
      .single();
    if (parentErr || !parent) {
      return NextResponse.json({ error: "parent note not found" }, { status: 404 });
    }
    if (parent.parentNoteId) {
      return NextResponse.json(
        { error: "Replies of replies are not allowed (1-level threading)" },
        { status: 400 },
      );
    }
    if (parent.leadId !== leadId) {
      return NextResponse.json({ error: "parent note belongs to a different lead" }, { status: 400 });
    }
    parentAuthorId = parent.authorId as string;
  }

  const now = new Date().toISOString();
  const { data: created, error: insErr } = await supabase
    .from("LeadNote")
    .insert({
      id: noteId(),
      leadId,
      authorId: user.userId,
      parentNoteId,
      content,
      editedAt: null,
      createdAt: now,
    })
    .select(LEAD_NOTE_COLUMNS)
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Fire-and-forget notifications.
  if (parentNoteId === null) {
    void notifyAllAdmins({
      title: "Catatan baru dari mentor",
      message: `${user.name} menambahkan catatan di lead ${lead.name}`,
      type: "lead_note_added",
      link: `/dashboard/admin/new-leads/${leadId}`,
    });
  } else if (parentAuthorId) {
    void notifyOne(parentAuthorId, {
      title: "Admin membalas catatan kamu",
      message: `${user.name} membalas catatanmu di lead ${lead.name}`,
      type: "lead_note_reply",
      link: `/dashboard/leads/${leadId}`,
    });
  }

  return NextResponse.json({ note: created }, { status: 201 });
}
