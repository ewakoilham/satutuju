import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("MenteeProfile")
    .select("*")
    .eq("userId", user.userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    profile: profile || null,
    email: user.email,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Remove fields that should not be set by the client
  delete body.id;
  delete body.userId;
  delete body.createdAt;
  delete body.updatedAt;

  // Check if profile exists
  const { data: existing } = await supabase
    .from("MenteeProfile")
    .select("id")
    .eq("userId", user.userId)
    .single();

  if (existing) {
    // Update
    const { data: updated, error } = await supabase
      .from("MenteeProfile")
      .update({ ...body, updatedAt: new Date().toISOString() })
      .eq("userId", user.userId)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: updated });
  } else {
    // Insert
    const { data: created, error } = await supabase
      .from("MenteeProfile")
      .insert({
        id: crypto.randomUUID(),
        userId: user.userId,
        ...body,
      })
      .select()
      .single();

    if (error) {
      console.error("Profile create error:", error);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: created });
  }
}
