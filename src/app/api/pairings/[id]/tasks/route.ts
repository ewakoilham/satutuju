import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: tasks, error } = await supabase
    .from("Task")
    .select("*")
    .eq("pairingId", id)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Tasks fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ tasks: tasks || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { data: pairing } = await supabase
    .from("Pairing")
    .select("id, menteeId")
    .eq("id", id)
    .single();

  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: task, error: taskError } = await supabase
    .from("Task")
    .insert({
      id: generateId(),
      pairingId: id,
      sessionNum: body.sessionNum,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
      assignedBy: user.userId,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (taskError || !task) {
    console.error("Task create error:", taskError);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Notify mentee
  await supabase.from("Notification").insert({
    id: generateId(),
    userId: pairing.menteeId,
    title: "New Task Assigned",
    message: `Your mentor assigned a new task: "${task.title}"`,
    type: "task",
    read: false,
    link: `/dashboard/pairings/${id}`,
    createdAt: now,
  });

  return NextResponse.json({ task }, { status: 201 });
}
