import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionNum: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sessionNum } = await params;
  const body = await req.json();

  // Find the session by pairingId + sessionNum (composite unique)
  const { data: session, error: sessionError } = await supabase
    .from("Session")
    .select("*")
    .eq("pairingId", id)
    .eq("sessionNum", parseInt(sessionNum))
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get the pairing for access check
  const { data: pairing } = await supabase
    .from("Pairing")
    .select("mentorId, menteeId")
    .eq("id", id)
    .single();

  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (
    user.role !== "admin" &&
    pairing.mentorId !== user.userId &&
    pairing.menteeId !== user.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("Session")
    .update({
      status: body.status ?? session.status,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt).toISOString() : session.scheduledAt,
      completedAt: body.status === "completed" ? now : session.completedAt,
      mentorRating: body.mentorRating ?? session.mentorRating,
      menteeEnergy: body.menteeEnergy ?? session.menteeEnergy,
      keyOutput: body.keyOutput ?? session.keyOutput,
      obstacles: body.obstacles ?? session.obstacles,
      summaryNotes: body.summaryNotes ?? session.summaryNotes,
      menteeFeedback: body.menteeFeedback ?? session.menteeFeedback,
      updatedAt: now,
    })
    .eq("id", session.id)
    .select()
    .single();

  if (updateError) {
    console.error("Session update error:", updateError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Notify mentor when mentee submits feedback or rating
  if (body.menteeFeedback || body.mentorRating) {
    const isMentee = pairing.menteeId === user.userId;
    if (isMentee) {
      const { data: mentee } = await supabase
        .from("User")
        .select("name")
        .eq("id", user.userId)
        .single();

      const mentorId = pairing.mentorId;

      if (body.menteeFeedback) {
        await supabase.from("Notification").insert({
          id: generateId(),
          userId: mentorId,
          title: "New Mentee Feedback",
          message: `${mentee?.name} left feedback on Session ${sessionNum}: "${body.menteeFeedback.slice(0, 80)}${body.menteeFeedback.length > 80 ? "..." : ""}"`,
          type: "session",
          read: false,
          link: `/dashboard/pairings/${id}`,
          createdAt: now,
        });
      }

      if (body.mentorRating) {
        await supabase.from("Notification").insert({
          id: generateId(),
          userId: mentorId,
          title: "Mentor Rating Received",
          message: `${mentee?.name} rated you ${body.mentorRating}/5 for Session ${sessionNum}.`,
          type: "session",
          read: false,
          link: `/dashboard/pairings/${id}`,
          createdAt: now,
        });
      }
    }
  }

  // If mentee energy <= 2 for two consecutive sessions, create an alert notification
  if (body.menteeEnergy && body.menteeEnergy <= 2) {
    const { data: prevSession } = await supabase
      .from("Session")
      .select("menteeEnergy")
      .eq("pairingId", id)
      .eq("sessionNum", parseInt(sessionNum) - 1)
      .single();

    if (prevSession?.menteeEnergy && prevSession.menteeEnergy <= 2) {
      // Find admins and notify
      const { data: admins } = await supabase
        .from("User")
        .select("id")
        .eq("role", "admin");

      const { data: pairingWithMentee } = await supabase
        .from("Pairing")
        .select("*, mentee:User!menteeId(name)")
        .eq("id", id)
        .single();

      for (const admin of admins || []) {
        await supabase.from("Notification").insert({
          id: generateId(),
          userId: admin.id,
          title: "Low Energy Alert",
          message: `${pairingWithMentee?.mentee?.name} has had energy rating <= 2 for 2 consecutive sessions.`,
          type: "alert",
          read: false,
          link: `/dashboard/pairings/${id}`,
          createdAt: now,
        });
      }
    }
  }

  return NextResponse.json({ session: updated });
}
