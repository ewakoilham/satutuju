import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, readAll } = await req.json();

  if (readAll) {
    await prisma.notification.updateMany({
      where: { userId: user.userId, read: false },
      data: { read: true },
    });
  } else if (id) {
    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
