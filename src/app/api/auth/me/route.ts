import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Fetch avatar from DB
  const { data } = await supabase
    .from("User")
    .select("avatar")
    .eq("id", user.userId)
    .single();

  return NextResponse.json({
    user: { ...user, avatar: data?.avatar || null },
  });
}
