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
  const role = String(body.role || "");
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Role tidak valid." }, { status: 400 });
  }

  // Accept a single `email` (back-compat, e.g. "Kirim ulang") or a list of
  // `emails` for bulk invites. Normalize, lowercase, dedupe.
  const rawList: string[] = Array.isArray(body.emails)
    ? body.emails.map((e: unknown) => String(e))
    : [String(body.email || "")];
  const emails = [...new Set(rawList.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) {
    return NextResponse.json({ error: "Tidak ada email." }, { status: 400 });
  }
  if (emails.length > 100) {
    return NextResponse.json({ error: "Maksimum 100 email per kirim." }, { status: 400 });
  }

  type Result = { email: string; status: "sent" | "reused" | "invalid" | "error"; error?: string };
  const results: Result[] = [];

  for (const email of emails) {
    if (!email.includes("@")) {
      results.push({ email, status: "invalid", error: "Email tidak valid." });
      continue;
    }
    try {
      // Reuse a non-expired unused invite if one exists, else issue a new one.
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
      const reused = !!token;
      if (!token) {
        token = crypto.randomBytes(24).toString("base64url");
        const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60_000).toISOString();
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
          results.push({ email, status: "error", error: "Gagal membuat undangan." });
          continue;
        }
      }

      await sendInviteEmail({
        to: email,
        inviterName: user.name,
        role: role as "mentor" | "mentee" | "admin",
        token,
      });
      results.push({ email, status: reused ? "reused" : "sent" });
    } catch (e) {
      console.error("[invites] send failed", email, e);
      results.push({ email, status: "error", error: "Gagal mengirim." });
    }
  }

  const sent = results.filter((r) => r.status === "sent" || r.status === "reused").length;
  return NextResponse.json({ ok: sent > 0, sent, results });
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
