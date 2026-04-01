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

  // Find the task and its pairing
  const { data: task, error: taskError } = await supabase
    .from("Task")
    .select("*, pairing:Pairing!pairingId(mentorId, menteeId)")
    .eq("id", id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("Task")
    .update({
      status: body.status ?? task.status,
      completedAt: body.status === "completed" ? now : task.completedAt,
      updatedAt: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Task update error:", updateError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Notify mentor when task completed by mentee
  if (body.status === "completed" && user.userId === task.pairing.menteeId) {
    await supabase.from("Notification").insert({
      id: generateId(),
      userId: task.pairing.mentorId,
      title: "Task Completed",
      message: `Your mentee completed: "${task.title}"`,
      type: "task",
      read: false,
      link: `/dashboard/pairings/${task.pairingId}`,
      createdAt: now,
    });
  }

  return NextResponse.json({ task: updated });
}
