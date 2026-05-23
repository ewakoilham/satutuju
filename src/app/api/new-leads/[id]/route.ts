import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  LEAD_SELECT_COLUMNS,
  LEAD_STAGE_HISTORY_COLUMNS,
  OUTREACH_LOG_COLUMNS,
  LEAD_STEP_DEFINITION_COLUMNS,
  LEAD_STEP_STATUS_COLUMNS,
  LEAD_NOTE_COLUMNS,
  MENTOR_LEAD_FLAG_COLUMNS,
} from "@/lib/db-columns";
import type { LeadNote, LeadNoteThread } from "@/lib/leads/types";

/**
 * Read a single lead with all related rows for the detail page:
 * - lead
 * - history (LeadStageHistory)
 * - outreach (OutreachLog)
 * - steps  (LeadStepDefinition[]) — all active steps, in display order
 * - statuses (LeadStepStatus[])   — this lead's row per step
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;

  const [leadRes, historyRes, outreachRes, stepsRes, statusesRes, notesRes, flagsRes] = await Promise.all([
    supabase.from("Lead").select(LEAD_SELECT_COLUMNS).eq("id", id).single(),
    supabase.from("LeadStageHistory").select(LEAD_STAGE_HISTORY_COLUMNS).eq("leadId", id).order("createdAt", { ascending: false }),
    supabase.from("OutreachLog").select(OUTREACH_LOG_COLUMNS).eq("leadId", id).order("sentAt", { ascending: false }),
    supabase.from("LeadStepDefinition").select(LEAD_STEP_DEFINITION_COLUMNS).eq("isActive", true).order("order", { ascending: true }),
    supabase.from("LeadStepStatus").select(LEAD_STEP_STATUS_COLUMNS).eq("leadId", id),
    // Phase 13: mentor notes + replies for this lead.
    supabase.from("LeadNote").select(LEAD_NOTE_COLUMNS).eq("leadId", id).order("createdAt", { ascending: false }),
    supabase.from("MentorLeadFlag").select(MENTOR_LEAD_FLAG_COLUMNS).eq("leadId", id).order("createdAt", { ascending: false }),
  ]);

  if (leadRes.error) {
    const code = leadRes.error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: leadRes.error.message }, { status: code });
  }

  // Hydrate author/mentor names for the notes thread + flag chips.
  const allRows = (notesRes.data ?? []) as LeadNote[];
  const flagRows = (flagsRes.data ?? []) as { id: string; leadId: string; mentorId: string; context: string | null; createdAt: string }[];
  const userIds = Array.from(
    new Set([
      ...allRows.map((n) => n.authorId),
      ...flagRows.map((f) => f.mentorId),
    ]),
  );
  const userMeta: Record<string, { name: string; role: string }> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("User")
      .select("id, name, role")
      .in("id", userIds);
    for (const u of users ?? []) {
      userMeta[u.id as string] = { name: u.name as string, role: u.role as string };
    }
  }

  // Build 1-level thread: top-level notes (parentNoteId=null) with
  // their admin replies nested under `replies`.
  const topLevel = allRows.filter((n) => !n.parentNoteId);
  const repliesByParent = new Map<string, LeadNote[]>();
  for (const n of allRows) {
    if (n.parentNoteId) {
      const arr = repliesByParent.get(n.parentNoteId) ?? [];
      arr.push(n);
      repliesByParent.set(n.parentNoteId, arr);
    }
  }
  const decorate = (n: LeadNote): LeadNoteThread => {
    const meta = userMeta[n.authorId];
    return {
      ...n,
      authorName: meta?.name ?? "—",
      authorRole: meta?.role ?? "—",
      replies: [],
    };
  };
  const thread: LeadNoteThread[] = topLevel.map((parent) => {
    const out = decorate(parent);
    const kids = repliesByParent.get(parent.id) ?? [];
    out.replies = kids
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(decorate);
    return out;
  });

  const flags = flagRows.map((f) => ({
    ...f,
    mentorName: userMeta[f.mentorId]?.name ?? "—",
  }));

  return NextResponse.json({
    lead: leadRes.data,
    history: historyRes.data ?? [],
    outreach: outreachRes.data ?? [],
    steps: stepsRes.data ?? [],
    statuses: statusesRes.data ?? [],
    notes: thread,
    flags,
  });
}

/** PATCH — update editable lead fields (name, email, whatsapp, target, funding, etc.). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist editable fields. System-derived (bucket, stage, etc.) only via
  // dedicated endpoints later.
  const EDITABLE = [
    "name", "email", "whatsappNumber", "targetCampusAndProgram", "fundingPlan",
    "assignedInterviewer", "depositTier", "readinessScore",
    "callScheduledAt", "callCompletedAt", "callNotes", "redFlags", "decision",
    "mentorMatchedId",
  ] as const;

  const update: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (k in body) update[k] = body[k];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }
  update.updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("Lead")
    .update(update)
    .eq("id", id)
    .select(LEAD_SELECT_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ lead: data });
}

/**
 * DELETE — permanently remove a lead + all its dependent rows
 * (LeadStageHistory / OutreachLog / LeadStepStatus cascade via Prisma
 * `onDelete: Cascade` on the relation).
 *
 * Destructive. Caller must pass `?confirm=<lead.name>` matching the
 * lead's stored name (URL-encoded) — defense-in-depth on top of the
 * UI's type-name-to-confirm modal. Off-by-one mistakes (wrong tab,
 * wrong row) get caught here.
 *
 * Audit trail is intentionally NOT preserved — once deleted, the row
 * is gone. Rollback path = re-sync from Tally (if the lead was Tally-
 * sourced; tallySubmissionId unique constraint still holds).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  const { id } = await params;
  const url = new URL(req.url);
  const expectedName = url.searchParams.get("confirm");
  if (!expectedName) {
    return NextResponse.json(
      { error: "Missing ?confirm=<lead name> query param. UI must include the lead's name to confirm intent." },
      { status: 400 },
    );
  }

  // Fetch the lead first to verify the confirmation matches AND to
  // surface a clear 404 vs 500.
  const { data: lead, error: lookupErr } = await supabase
    .from("Lead").select("id, name, email, tallySubmissionId").eq("id", id).single();
  if (lookupErr) {
    const code = lookupErr.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: lookupErr.message }, { status: code });
  }
  if (lead.name.trim() !== expectedName.trim()) {
    return NextResponse.json(
      { error: `Confirmation name mismatch. Expected "${lead.name}", got "${expectedName}".` },
      { status: 400 },
    );
  }

  const { error: delErr } = await supabase.from("Lead").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    deletedId: id,
    deletedName: lead.name,
    tallyBackedUp: lead.tallySubmissionId !== null,
  });
}
