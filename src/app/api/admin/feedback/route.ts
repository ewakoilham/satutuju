import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all sessions that have feedback or ratings, with pairing info
  // Supabase doesn't support OR on "not null" directly in PostgREST the same way,
  // so we fetch sessions that have mentorRating or menteeFeedback by fetching all
  // completed-ish sessions and filtering in JS.
  const { data: sessions, error } = await supabase
    .from("Session")
    .select(
      "*, pairing:Pairing!pairingId(mentorId, mentor:User!mentorId(id, name), mentee:User!menteeId(id, name))"
    )
    .order("updatedAt", { ascending: false });

  if (error) {
    console.error("Feedback sessions fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Filter to only sessions with feedback or ratings
  const filteredSessions = (sessions || []).filter(
    (s: Record<string, unknown>) => s.menteeFeedback !== null || s.mentorRating !== null
  );

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

  for (const s of filteredSessions) {
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

  // Build per-mentor feedback items list
  const mentorFeedbackItems: Record<string, Array<{
    sessionNum: number;
    menteeName: string;
    mentorRating: number | null;
    menteeFeedback: string;
    pairingId: string;
    updatedAt: string;
  }>> = {};

  for (const s of filteredSessions) {
    if (!s.menteeFeedback) continue;
    const mid = s.pairing.mentorId;
    if (!mentorFeedbackItems[mid]) mentorFeedbackItems[mid] = [];
    mentorFeedbackItems[mid].push({
      sessionNum: s.sessionNum,
      menteeName: s.pairing.mentee.name,
      mentorRating: s.mentorRating,
      menteeFeedback: s.menteeFeedback,
      pairingId: s.pairingId,
      updatedAt: s.updatedAt,
    });
  }

  const mentorSummaries = Object.values(mentorStats).map((s) => ({
    mentorId: s.mentorId,
    mentorName: s.mentorName,
    avgRating: Math.round(s.avgRating * 10) / 10,
    totalRatings: s.totalRatings,
    feedbackCount: s.feedbackCount,
    pairingCount: s.pairingIds.size,
    feedbackItems: mentorFeedbackItems[s.mentorId] || [],
  }));

  // Recent feedback list
  const recentFeedback = filteredSessions
    .filter((s: Record<string, unknown>) => s.menteeFeedback)
    .slice(0, 20)
    .map((s: Record<string, unknown>) => ({
      sessionNum: s.sessionNum,
      mentorName: (s.pairing as Record<string, unknown> & { mentor: { name: string } }).mentor.name,
      menteeName: (s.pairing as Record<string, unknown> & { mentee: { name: string } }).mentee.name,
      mentorRating: s.mentorRating,
      menteeFeedback: s.menteeFeedback,
      pairingId: s.pairingId,
      updatedAt: s.updatedAt,
    }));

  return NextResponse.json({ mentorSummaries, recentFeedback });
}
