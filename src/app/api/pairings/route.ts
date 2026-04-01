import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CURRICULUM } from "@/lib/curriculum";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let pairings;
  if (user.role === "admin") {
    pairings = await prisma.pairing.findMany({
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        mentee: { select: { id: true, name: true, email: true } },
        sessions: { orderBy: { sessionNum: "asc" } },
        _count: { select: { documents: true, tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (user.role === "mentor") {
    pairings = await prisma.pairing.findMany({
      where: { mentorId: user.userId },
      include: {
        mentee: { select: { id: true, name: true, email: true } },
        sessions: { orderBy: { sessionNum: "asc" } },
        _count: { select: { documents: true, tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    pairings = await prisma.pairing.findMany({
      where: { menteeId: user.userId },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        sessions: { orderBy: { sessionNum: "asc" } },
        _count: { select: { documents: true, tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ pairings });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mentorId, menteeId, targetProgram, priorityUnis, ieltsScore } =
    await req.json();

  if (!mentorId || !menteeId) {
    return NextResponse.json({ error: "Missing mentor or mentee" }, { status: 400 });
  }

  const pairing = await prisma.pairing.create({
    data: {
      mentorId,
      menteeId,
      targetProgram,
      priorityUnis: priorityUnis ? JSON.stringify(priorityUnis) : null,
      ieltsScore,
    },
  });

  // Auto-create the 10 sessions from curriculum
  await prisma.session.createMany({
    data: CURRICULUM.map((s) => ({
      pairingId: pairing.id,
      sessionNum: s.sessionNum,
      phase: s.phase,
      topic: s.topic,
      status: s.sessionNum === 1 ? "upcoming" : "upcoming",
    })),
  });

  return NextResponse.json({ pairing }, { status: 201 });
}
