import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tasks = await prisma.task.findMany({
    where: { pairingId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const pairing = await prisma.pairing.findUnique({ where: { id } });
  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const task = await prisma.task.create({
    data: {
      pairingId: id,
      sessionNum: body.sessionNum,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      assignedBy: user.userId,
    },
  });

  // Notify mentee
  await prisma.notification.create({
    data: {
      userId: pairing.menteeId,
      title: "New Task Assigned",
      message: `Your mentor assigned a new task: "${task.title}"`,
      type: "task",
      link: `/dashboard/pairings/${id}`,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
