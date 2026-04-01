import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionNum: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, sessionNum } = await params;
  const body = await req.json();

  const session = await prisma.session.findUnique({
    where: { pairingId_sessionNum: { pairingId: id, sessionNum: parseInt(sessionNum) } },
    include: { pairing: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (
    user.role !== "admin" &&
    session.pairing.mentorId !== user.userId &&
    session.pairing.menteeId !== user.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: body.status ?? session.status,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : session.scheduledAt,
      completedAt: body.status === "completed" ? new Date() : session.completedAt,
      mentorRating: body.mentorRating ?? session.mentorRating,
      menteeEnergy: body.menteeEnergy ?? session.menteeEnergy,
      keyOutput: body.keyOutput ?? session.keyOutput,
      obstacles: body.obstacles ?? session.obstacles,
      summaryNotes: body.summaryNotes ?? session.summaryNotes,
      menteeFeedback: body.menteeFeedback ?? session.menteeFeedback,
    },
  });

  // Notify mentor when mentee submits feedback or rating
  if (body.menteeFeedback || body.mentorRating) {
    const isMentee = session.pairing.menteeId === user.userId;
    if (isMentee) {
      const mentee = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { name: true },
      });
      const mentorId = session.pairing.mentorId;

      if (body.menteeFeedback) {
        await prisma.notification.create({
          data: {
            userId: mentorId,
            title: "New Mentee Feedback",
            message: `${mentee?.name} left feedback on Session ${sessionNum}: "${body.menteeFeedback.slice(0, 80)}${body.menteeFeedback.length > 80 ? "..." : ""}"`,
            type: "session",
            link: `/dashboard/pairings/${id}`,
          },
        });
      }

      if (body.mentorRating) {
        await prisma.notification.create({
          data: {
            userId: mentorId,
            title: "Mentor Rating Received",
            message: `${mentee?.name} rated you ${body.mentorRating}/5 for Session ${sessionNum}.`,
            type: "session",
            link: `/dashboard/pairings/${id}`,
          },
        });
      }
    }
  }

  // If mentee energy <= 2 for two consecutive sessions, create an alert notification
  if (body.menteeEnergy && body.menteeEnergy <= 2) {
    const prevSession = await prisma.session.findUnique({
      where: {
        pairingId_sessionNum: {
          pairingId: id,
          sessionNum: parseInt(sessionNum) - 1,
        },
      },
    });

    if (prevSession?.menteeEnergy && prevSession.menteeEnergy <= 2) {
      // Find admins and notify
      const admins = await prisma.user.findMany({ where: { role: "admin" } });
      const pairing = await prisma.pairing.findUnique({
        where: { id },
        include: { mentee: { select: { name: true } } },
      });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Low Energy Alert",
            message: `${pairing?.mentee.name} has had energy rating <= 2 for 2 consecutive sessions.`,
            type: "alert",
            link: `/dashboard/pairings/${id}`,
          },
        });
      }
    }
  }

  return NextResponse.json({ session: updated });
}
