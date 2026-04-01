import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: notifications, error } = await supabase
    .from("Notification")
    .select("*")
    .eq("userId", user.userId)
    .order("createdAt", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ notifications: notifications || [] });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, readAll } = await req.json();

  if (readAll) {
    await supabase
      .from("Notification")
      .update({ read: true })
      .eq("userId", user.userId)
      .eq("read", false);
  } else if (id) {
    await supabase
      .from("Notification")
      .update({ read: true })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
