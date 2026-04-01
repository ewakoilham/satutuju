import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  // Role-based access control
  if (user.role === "admin") {
    // Admin can view any profile
  } else if (user.role === "mentor") {
    // Mentor can only view profiles of mentees they are paired with
    const { data: pairing } = await supabase
      .from("Pairing")
      .select("id")
      .eq("mentorId", user.userId)
      .eq("menteeId", userId)
      .limit(1)
      .single();

    if (!pairing) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (user.role === "mentee") {
    // Mentee can only view their own profile
    if (user.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch user info
  const { data: targetUser, error: userError } = await supabase
    .from("User")
    .select("name, email")
    .eq("id", userId)
    .single();

  if (userError) {
    console.error("User fetch error:", userError);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile, error } = await supabase
    .from("MenteeProfile")
    .select("*")
    .eq("userId", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    profile: profile || null,
    name: targetUser.name,
    email: targetUser.email,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  // Role-based access control
  if (user.role === "admin") {
    // Admin can update any profile
  } else if (user.role === "mentor") {
    const { data: pairing } = await supabase
      .from("Pairing")
      .select("id")
      .eq("mentorId", user.userId)
      .eq("menteeId", userId)
      .limit(1)
      .single();

    if (!pairing) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (user.role === "mentee") {
    if (user.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    .eq("userId", userId)
    .single();

  if (existing) {
    // Update
    const { data: updated, error } = await supabase
      .from("MenteeProfile")
      .update({ ...body, updatedAt: new Date().toISOString() })
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: updated });
  } else {
    // Insert
    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("MenteeProfile")
      .insert({
        id: crypto.randomUUID(),
        userId,
        ...body,
        createdAt: now,
        updatedAt: now,
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
