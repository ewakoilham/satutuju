import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all sessions that have feedback or ratings, with pairing info
  const sessions = await prisma.session.findMany({
    where: {
      OR: [
        { menteeFeedback: { not: null } },
        { mentorRating: { not: null } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      pairing: {
        include: {
          mentor: { select: { id: true, name: true } },
          mentee: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Aggregate per mentor
  const mentorStats: Record<
    string,
    {
      mentorId: string;
      mentorName: string;
      totalRatings: number;
      sumRatings: number;
      avgRating: number;
      feedbackCount: number;
      pairingCount: number;
      pairingIds: Set<string>;
    }
  > = {};

  for (const s of sessions) {
    const mid = s.pairing.mentorId;
    if (!mentorStats[mid]) {
      mentorStats[mid] = {
        mentorId: mid,
        mentorName: s.pairing.mentor.name,
        totalRatings: 0,
        sumRatings: 0,
        avgRating: 0,
        feedbackCount: 0,
        pairingCount: 0,
        pairingIds: new Set(),
      };
    }
    const stat = mentorStats[mid];
    stat.pairingIds.add(s.pairingId);
    if (s.mentorRating) {
      stat.totalRatings++;
      stat.sumRatings += s.mentorRating;
      stat.avgRating = stat.sumRatings / stat.totalRatings;
    }
    if (s.menteeFeedback) {
      stat.feedbackCount++;
    }
  }

  const mentorSummaries = Object.values(mentorStats).map((s) => ({
    mentorId: s.mentorId,
    mentorName: s.mentorName,
    avgRating: Math.round(s.avgRating * 10) / 10,
    totalRatings: s.totalRatings,
    feedbackCount: s.feedbackCount,
    pairingCount: s.pairingIds.size,
  }));

  // Recent feedback list
  const recentFeedback = sessions
    .filter((s) => s.menteeFeedback)
    .slice(0, 20)
    .map((s) => ({
      sessionNum: s.sessionNum,
      mentorName: s.pairing.mentor.name,
      menteeName: s.pairing.mentee.name,
      mentorRating: s.mentorRating,
      menteeFeedback: s.menteeFeedback,
      pairingId: s.pairingId,
      updatedAt: s.updatedAt,
    }));

  return NextResponse.json({ mentorSummaries, recentFeedback });
}
