import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  const { data: profile, error } = await supabase
    .from("MentorProfile")
    .select("*")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Mentor profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Also fetch the user's name/email for display
  const { data: mentorUser } = await supabase
    .from("User")
    .select("id, name, email")
    .eq("id", userId)
    .single();

  return NextResponse.json({ profile: profile || null, user: mentorUser || null });
}
