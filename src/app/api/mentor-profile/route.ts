import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("MentorProfile")
    .select("*")
    .eq("userId", user.userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Mentor profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ profile: profile || null });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  delete body.id;
  delete body.userId;
  delete body.createdAt;
  delete body.updatedAt;

  const { data: existing } = await supabase
    .from("MentorProfile")
    .select("id")
    .eq("userId", user.userId)
    .single();

  const now = new Date().toISOString();

  if (existing) {
    const { data: updated, error } = await supabase
      .from("MentorProfile")
      .update({ ...body, updatedAt: now })
      .eq("userId", user.userId)
      .select()
      .single();

    if (error) {
      console.error("Mentor profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
    return NextResponse.json({ profile: updated });
  } else {
    const { data: created, error } = await supabase
      .from("MentorProfile")
      .insert({ id: crypto.randomUUID(), userId: user.userId, ...body, createdAt: now, updatedAt: now })
      .select()
      .single();

    if (error) {
      console.error("Mentor profile create error:", error);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }
    return NextResponse.json({ profile: created });
  }
}
