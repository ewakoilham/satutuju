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
  const pairing = await prisma.pairing.findUnique({
    where: { id },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
      sessions: { orderBy: { sessionNum: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      progressNotes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!pairing) {
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

  return NextResponse.json({ pairing });
}
