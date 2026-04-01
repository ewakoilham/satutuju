import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: pairing, error } = await supabase
    .from("Pairing")
    .select(
      "*, mentor:User!mentorId(id, name, email), mentee:User!menteeId(id, name, email), sessions:Session(*), documents:Document(*), tasks:Task(*), progressNotes:ProgressNote(*)"
    )
    .eq("id", id)
    .single();

  if (error || !pairing) {
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

  // Sort nested arrays
  if (Array.isArray(pairing.sessions)) {
    pairing.sessions.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        (a.sessionNum as number) - (b.sessionNum as number)
    );
  }
  if (Array.isArray(pairing.documents)) {
    pairing.documents.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }
  if (Array.isArray(pairing.tasks)) {
    pairing.tasks.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }
  if (Array.isArray(pairing.progressNotes)) {
    pairing.progressNotes.sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
    );
  }

  return NextResponse.json({ pairing });
}
