import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: user } = await supabase
    .from("User")
    .select("id, resetToken, resetTokenExpiresAt")
    .eq("resetToken", token)
    .single();

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < now) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await supabase
    .from("User")
    .update({
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiresAt: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
