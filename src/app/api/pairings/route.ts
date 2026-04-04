import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { CURRICULUM } from "@/lib/curriculum";

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabase.from("Pairing").select(
    "*, mentor:User!mentorId(id, name, email), mentee:User!menteeId(id, name, email), sessions:Session(*), documents:Document(id), tasks:Task(id)"
  );

  if (user.role === "mentor") {
    query = query.eq("mentorId", user.userId);
  } else if (user.role !== "admin") {
    query = query.eq("menteeId", user.userId);
  }

  const { data: pairings, error } = await query.order("createdAt", { ascending: false });

  if (error) {
    console.error("Pairings fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Fetch mentee profiles for live program data
  const menteeIds = [...new Set((pairings || []).map((p: Record<string, unknown>) => p.menteeId as string))];
  const menteeProfiles: Record<string, { intendedStudyProgram?: string; preferredDestinations?: string }> = {};
  if (menteeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("MenteeProfile")
      .select("userId, intendedStudyProgram, preferredDestinations")
      .in("userId", menteeIds);
    if (profiles) {
      for (const mp of profiles) {
        menteeProfiles[mp.userId] = {
          intendedStudyProgram: mp.intendedStudyProgram,
          preferredDestinations: mp.preferredDestinations,
        };
      }
    }
  }

  // Sort sessions by sessionNum and compute _count equivalents
  const result = (pairings || []).map((p: Record<string, unknown>) => {
    const sessions = Array.isArray(p.sessions)
      ? [...p.sessions].sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            (a.sessionNum as number) - (b.sessionNum as number)
        )
      : [];
    const documentsCount = Array.isArray(p.documents) ? p.documents.length : 0;
    const tasksCount = Array.isArray(p.tasks) ? p.tasks.length : 0;

    // Remove raw arrays used only for counting, keep mentor/mentee
    const { documents: _docs, tasks: _tasks, ...rest } = p as Record<string, unknown>;
    return {
      ...rest,
      sessions,
      _count: { documents: documentsCount, tasks: tasksCount },
      menteeProfile: menteeProfiles[p.menteeId as string] || null,
    };
  });

  return NextResponse.json({ pairings: result });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mentorId, menteeId, priorityUnis, ieltsScore } =
    await req.json();

  if (!mentorId || !menteeId) {
    return NextResponse.json({ error: "Missing mentor or mentee" }, { status: 400 });
  }

  // Auto-fetch target program from mentee's profile
  const { data: menteeProfile } = await supabase
    .from("MenteeProfile")
    .select("intendedStudyProgram")
    .eq("userId", menteeId)
    .single();
  const targetProgram = menteeProfile?.intendedStudyProgram || null;

  // Enforce one active pairing per mentee
  const { data: existingActive } = await supabase
    .from("Pairing")
    .select("id")
    .eq("menteeId", menteeId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (existingActive) {
    return NextResponse.json(
      { error: "This mentee already has an active pairing. Cancel it before creating a new one." },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const pairingId = generateId();

  const { data: pairing, error: pairingError } = await supabase
    .from("Pairing")
    .insert({
      id: pairingId,
      mentorId,
      menteeId,
      status: "active",
      track: "full",
      startDate: now,
      targetProgram: targetProgram || null,
      priorityUnis: priorityUnis ? JSON.stringify(priorityUnis) : null,
      ieltsScore: ieltsScore || null,
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (pairingError || !pairing) {
    console.error("Pairing create error:", pairingError);
    const msg = pairingError?.message?.includes("duplicate")
      ? "This mentor-mentee pairing already exists"
      : "Failed to create pairing";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Auto-create the 10 sessions from curriculum
  const sessionRows = CURRICULUM.map((s) => ({
    id: generateId(),
    pairingId: pairing.id,
    sessionNum: s.sessionNum,
    phase: s.phase,
    topic: s.topic,
    status: "upcoming",
    createdAt: now,
    updatedAt: now,
  }));

  const { error: sessionsError } = await supabase.from("Session").insert(sessionRows);

  if (sessionsError) {
    console.error("Sessions create error:", sessionsError);
  }

  return NextResponse.json({ pairing }, { status: 201 });
}
