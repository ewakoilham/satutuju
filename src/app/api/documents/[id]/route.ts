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

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { pairing: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: body.status ?? doc.status,
      feedback: body.feedback ?? doc.feedback,
    },
  });

  // Notify mentee when mentor reviews
  if (body.status && user.userId === doc.pairing.mentorId) {
    const statusLabel =
      body.status === "approved"
        ? "approved"
        : body.status === "needs_revision"
        ? "needs revision"
        : body.status;
    await prisma.notification.create({
      data: {
        userId: doc.pairing.menteeId,
        title: "Document Review Update",
        message: `Your document "${doc.name}" has been marked as ${statusLabel}.`,
        type: "document",
        link: `/dashboard/pairings/${doc.pairingId}`,
      },
    });
  }

  return NextResponse.json({ document: updated });
}
