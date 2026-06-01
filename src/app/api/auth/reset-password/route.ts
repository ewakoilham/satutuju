/** Reset-password — v5: consume MagicLink instead of User.resetToken.
 *
 *  Backward-compatible: still accepts old User.resetToken values for any
 *  emails issued before this migration landed. New tokens come from
 *  MagicLink (single-use, 24h, hashed at rest). */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { consumeMagicLink } from "@/lib/magic-link";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Tautan reset tidak valid atau kedaluwarsa." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Kunci minimal ${MIN_PASSWORD_LENGTH} karakter.` },
      { status: 400 },
    );
  }

  // Try the new MagicLink path first.
  const magic = await consumeMagicLink(token);
  let userId = magic?.userId ?? null;

  // Legacy fallback for tokens issued before this migration.
  if (!userId) {
    const { data: legacyUser } = await supabase
      .from("User")
      .select("id, resetTokenExpiresAt")
      .eq("resetToken", token)
      .maybeSingle();
    if (legacyUser && legacyUser.resetTokenExpiresAt && legacyUser.resetTokenExpiresAt > new Date().toISOString()) {
      userId = legacyUser.id;
      // Burn the legacy token so it can't be reused.
      await supabase.from("User").update({ resetToken: null, resetTokenExpiresAt: null }).eq("id", legacyUser.id);
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "Tautan reset tidak valid atau kedaluwarsa." }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  await supabase.from("User").update({ password: hashed, isActivated: true }).eq("id", userId);

  return NextResponse.json({ ok: true });
}
