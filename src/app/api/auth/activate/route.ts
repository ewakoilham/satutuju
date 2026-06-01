/** Activate API.
 *
 *  GET  /api/auth/activate?token=...
 *    Returns { email, role, expiresAt } if the invite is valid (unused +
 *    not expired). 404 otherwise. Used by the /activate page so the UI
 *    can show the invited email + Google fallback link without the user
 *    having to type their address.
 *
 *  POST /api/auth/activate
 *    Body: { token, password, name?, confirm? } — burns the invite,
 *    creates/upgrades the User row, issues a JWT cookie. */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import { createToken } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token kosong" }, { status: 400 });
  const { data: invite } = await supabase
    .from("InviteToken")
    .select("email, role, expiresAt, usedAt")
    .eq("token", token)
    .maybeSingle();
  if (!invite || invite.usedAt || new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json(
      { error: "Tautan undangan tidak valid atau sudah kedaluwarsa." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token || "");
  const password = String(body.password || "");
  const displayName = body.name ? String(body.name).trim() : null;

  if (!token) return NextResponse.json({ error: "Token tidak valid" }, { status: 400 });
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Kunci minimal ${MIN_PASSWORD_LENGTH} karakter.` },
      { status: 400 },
    );
  }

  // Burn token atomically — only if it's unused AND not expired.
  const nowIso = new Date().toISOString();
  const { data: invite, error } = await supabase
    .from("InviteToken")
    .update({ usedAt: nowIso })
    .eq("token", token)
    .is("usedAt", null)
    .gt("expiresAt", nowIso)
    .select("id, email, role")
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json(
      { error: "Tautan undangan tidak valid atau sudah kedaluwarsa." },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(password, 10);

  // Upsert by email — there might be a placeholder User row from an earlier
  // pairing creation; otherwise we make one fresh.
  const { data: existing } = await supabase
    .from("User")
    .select("id")
    .eq("email", invite.email)
    .maybeSingle();

  let userId: string;
  let name: string;
  if (existing) {
    userId = existing.id;
    await supabase
      .from("User")
      .update({
        password: hashed,
        isActivated: true,
        invitedAt: nowIso,
        ...(displayName ? { name: displayName } : {}),
        updatedAt: nowIso,
      })
      .eq("id", existing.id);
    const { data: refreshed } = await supabase.from("User").select("name, role").eq("id", existing.id).single();
    name = refreshed?.name ?? displayName ?? invite.email.split("@")[0];
  } else {
    userId = globalThis.crypto.randomUUID();
    name = displayName || invite.email.split("@")[0];
    const { error: insErr } = await supabase.from("User").insert({
      id: userId,
      email: invite.email,
      name,
      role: invite.role,
      password: hashed,
      isActivated: true,
      invitedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    if (insErr) {
      console.error("[activate] user insert failed", insErr);
      return NextResponse.json({ error: "Gagal mengaktifkan akun." }, { status: 500 });
    }
  }

  const jwt = await createToken({ userId, email: invite.email, role: invite.role, name });
  const res = NextResponse.json({
    user: { id: userId, email: invite.email, name, role: invite.role },
  });
  res.cookies.set("token", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
