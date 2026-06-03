/** Admin-only invite endpoint.
 *
 *  POST /api/invites  — issue an invite token for an email + role; sends
 *  the email and returns { token, expiresAt }.
 *  GET  /api/invites  — list invites the caller issued (most recent 50).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/email-templates";

const VALID_ROLES = new Set(["mentor", "mentee", "admin"]);
const EXPIRY_DAYS = 7;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "");
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
  }

  // If a non-expired unused invite already exists for this email, reuse it
  // instead of issuing a duplicate. Keeps admins from accidentally sending
  // two emails to the same person.
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("InviteToken")
    .select("token, expiresAt")
    .eq("email", email)
    .is("usedAt", null)
    .gt("expiresAt", nowIso)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = existing?.token;
  let expiresAt = existing?.expiresAt;
  if (!token) {
    token = crypto.randomBytes(24).toString("base64url");
    expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60_000).toISOString();
    const { error } = await supabase.from("InviteToken").insert({
      id: globalThis.crypto.randomUUID(),
      email,
      role,
      invitedBy: user.userId,
      token,
      expiresAt,
      createdAt: nowIso,
    });
    if (error) {
      console.error("[invites] insert failed", error);
      return NextResponse.json({ error: "Gagal membuat undangan." }, { status: 500 });
    }
  }

  await sendInviteEmail({
    to: email,
    inviterName: user.name,
    role: role as "mentor" | "mentee" | "admin",
    token,
  });

  return NextResponse.json({ ok: true, expiresAt });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data } = await supabase
    .from("InviteToken")
    .select("id, email, role, invitedBy, expiresAt, usedAt, createdAt")
    .eq("invitedBy", user.userId)
    .order("createdAt", { ascending: false })
    .limit(50);
  return NextResponse.json({ invites: data || [] });
}
