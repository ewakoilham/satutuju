import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const task = await prisma.task.findUnique({
    where: { id },
    include: { pairing: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: body.status ?? task.status,
      completedAt: body.status === "completed" ? new Date() : task.completedAt,
    },
  });

  // Notify mentor when task completed by mentee
  if (body.status === "completed" && user.userId === task.pairing.menteeId) {
    await prisma.notification.create({
      data: {
        userId: task.pairing.mentorId,
        title: "Task Completed",
        message: `Your mentee completed: "${task.title}"`,
        type: "task",
        link: `/dashboard/pairings/${task.pairingId}`,
      },
    });
  }

  return NextResponse.json({ task: updated });
}
