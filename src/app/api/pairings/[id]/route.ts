import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: pairing, error } = await supabase
    .from("Pairing")
    .select(
      "*, mentor:User!mentorId(id, name, email), mentee:User!menteeId(id, name, email), sessions:Session(*), documents:Document(*), tasks:Task(*), progressNotes:ProgressNote(*)"
    )
    .eq("id", id)
    .single();

  if (error || !pairing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check access
  if (
    user.role !== "admin" &&
    pairing.mentorId !== user.userId &&
    pairing.menteeId !== user.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sort nested arrays
  if (Array.isArray(pairing.sessions)) {
    pairing.sessions.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.sessionNum as number) - (b.sessionNum as number)
    );
  }
  if (Array.isArray(pairing.documents)) {
    pairing.documents.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }
  if (Array.isArray(pairing.tasks)) {
    pairing.tasks.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }
  if (Array.isArray(pairing.progressNotes)) {
    pairing.progressNotes.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }

  // Attach live mentee profile data
  const { data: menteeProfile } = await supabase
    .from("MenteeProfile")
    .select("intendedStudyProgram, preferredDestinations")
    .eq("userId", pairing.menteeId)
    .single();

  return NextResponse.json({ pairing: { ...pairing, menteeProfile: menteeProfile || null } });
}

function generateId(): string {
  return crypto.randomUUID();
}

// ── PATCH: Replace mentor on a pairing (admin only) ──
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const { mentorId: newMentorId } = await req.json();

  if (!newMentorId) {
    return NextResponse.json({ error: "Missing mentorId" }, { status: 400 });
  }

  // Fetch current pairing with mentor/mentee names
  const { data: pairing, error: fetchErr } = await supabase
    .from("Pairing")
    .select("*, mentor:User!mentorId(id, name), mentee:User!menteeId(id, name)")
    .eq("id", id)
    .single();

  if (fetchErr || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (pairing.mentorId === newMentorId) {
    return NextResponse.json({ error: "Same mentor — no change needed" }, { status: 400 });
  }

  if (pairing.status === "cancelled") {
    return NextResponse.json({ error: "Cannot modify a cancelled pairing" }, { status: 400 });
  }

  // Check unique constraint: no active pairing between new mentor and this mentee
  const { data: existing } = await supabase
    .from("Pairing")
    .select("id")
    .eq("mentorId", newMentorId)
    .eq("menteeId", pairing.menteeId)
    .neq("status", "cancelled")
    .single();

  if (existing) {
    return NextResponse.json({ error: "This mentor is already paired with this mentee" }, { status: 409 });
  }

  // Fetch new mentor name
  const { data: newMentor } = await supabase
    .from("User")
    .select("id, name")
    .eq("id", newMentorId)
    .single();

  if (!newMentor) {
    return NextResponse.json({ error: "New mentor not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Update pairing
  const { error: updateErr } = await supabase
    .from("Pairing")
    .update({ mentorId: newMentorId, updatedAt: now })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update pairing", detail: updateErr.message }, { status: 500 });
  }

  // Send notifications
  const menteeName = pairing.mentee?.name || "mentee";
  const newMentorName = newMentor.name;

  await supabase.from("Notification").insert([
    {
      id: generateId(),
      userId: pairing.mentorId,
      title: "Pairing Update",
      message: `You have been removed from your mentorship pairing with ${menteeName}.`,
      type: "pairing",
      read: false,
      link: `/dashboard`,
      createdAt: now,
    },
    {
      id: generateId(),
      userId: newMentorId,
      title: "New Pairing Assignment",
      message: `You have been assigned as mentor for ${menteeName}.`,
      type: "pairing",
      read: false,
      link: `/dashboard/pairings/${id}`,
      createdAt: now,
    },
    {
      id: generateId(),
      userId: pairing.menteeId,
      title: "Mentor Changed",
      message: `Your mentor has been changed to ${newMentorName}.`,
      type: "pairing",
      read: false,
      link: `/dashboard/pairings/${id}`,
      createdAt: now,
    },
  ]);

  return NextResponse.json({ ok: true });
}

// ── PUT: Reopen an archived pairing (admin only) ──
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;

  const { data: pairing, error: fetchErr } = await supabase
    .from("Pairing")
    .select("*, mentor:User!mentorId(id, name), mentee:User!menteeId(id, name)")
    .eq("id", id)
    .single();

  if (fetchErr || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (pairing.status === "active") {
    return NextResponse.json({ error: "Pairing is already active" }, { status: 400 });
  }

  // Block reopen if mentee already has a different active pairing
  const { data: existingActive } = await supabase
    .from("Pairing")
    .select("id")
    .eq("menteeId", pairing.menteeId)
    .eq("status", "active")
    .neq("id", id)
    .limit(1)
    .single();

  if (existingActive) {
    return NextResponse.json(
      { error: "This mentee already has an active pairing. Cancel it before reopening this one." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("Pairing")
    .update({ status: "active", updatedAt: now })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to reopen pairing", detail: updateErr.message }, { status: 500 });
  }

  const menteeName = pairing.mentee?.name || "mentee";
  const mentorName = pairing.mentor?.name || "mentor";

  await supabase.from("Notification").insert([
    {
      id: generateId(),
      userId: pairing.mentorId,
      title: "Pairing Reopened",
      message: `Your mentorship pairing with ${menteeName} has been reopened.`,
      type: "pairing",
      read: false,
      link: `/dashboard/pairings/${id}`,
      createdAt: now,
    },
    {
      id: generateId(),
      userId: pairing.menteeId,
      title: "Pairing Reopened",
      message: `Your mentorship pairing with ${mentorName} has been reopened.`,
      type: "pairing",
      read: false,
      link: `/dashboard/pairings/${id}`,
      createdAt: now,
    },
  ]);

  return NextResponse.json({ ok: true });
}

// ── DELETE: Cancel a pairing (soft) or permanently delete (hard) ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  // Fetch pairing with names
  const { data: pairing, error: fetchErr } = await supabase
    .from("Pairing")
    .select("*, mentor:User!mentorId(id, name), mentee:User!menteeId(id, name)")
    .eq("id", id)
    .single();

  if (fetchErr || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (permanent) {
    // Hard delete — cascades to sessions, documents, tasks, progressNotes
    const { error: deleteErr } = await supabase
      .from("Pairing")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return NextResponse.json({ error: "Failed to delete pairing", detail: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // Soft delete — mark as cancelled
  if (pairing.status === "cancelled") {
    return NextResponse.json({ error: "Pairing already cancelled" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("Pairing")
    .update({ status: "cancelled", updatedAt: now })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to cancel pairing", detail: updateErr.message }, { status: 500 });
  }

  const menteeName = pairing.mentee?.name || "mentee";
  const mentorName = pairing.mentor?.name || "mentor";

  await supabase.from("Notification").insert([
    {
      id: generateId(),
      userId: pairing.mentorId,
      title: "Pairing Cancelled",
      message: `Your mentorship pairing with ${menteeName} has been cancelled.`,
      type: "pairing",
      read: false,
      link: `/dashboard`,
      createdAt: now,
    },
    {
      id: generateId(),
      userId: pairing.menteeId,
      title: "Pairing Cancelled",
      message: `Your mentorship pairing with ${mentorName} has been cancelled.`,
      type: "pairing",
      read: false,
      link: `/dashboard`,
      createdAt: now,
    },
  ]);

  return NextResponse.json({ ok: true });
}
