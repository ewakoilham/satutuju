import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createToken } from "@/lib/auth";

function generateId(): string {
  return crypto.randomUUID();
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Admin role cannot be self-assigned via signup
    const validRoles = ["mentor", "mentee"];
    const userRole = validRoles.includes(role) ? role : "mentee";

    const { data: existing } = await supabase
      .from("User")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const { data: user, error } = await supabase
      .from("User")
      .insert({
        id: generateId(),
        email,
        password: hashed,
        name,
        role: userRole,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error || !user) {
      console.error("Signup insert error:", error);
      return NextResponse.json(
        { error: "Internal server error", detail: error?.message },
        { status: 500 }
      );
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch (err: unknown) {
    const error = err as Error & { code?: string; meta?: unknown };
    console.error("Signup error:", error.message, error.code, error.meta);
    return NextResponse.json(
      { error: "Internal server error", detail: error.message },
      { status: 500 }
    );
  }
}
