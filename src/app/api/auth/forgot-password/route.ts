/** Forgot-password — v5 hardened.
 *
 *  Constant-response: always returns 200 regardless of whether the email
 *  exists, preventing enumeration. If the email *is* registered, we issue
 *  a MagicLink (24h, single-use) and mail it via the centralised template
 *  helper. The /reset-password page consumes the token via consumeMagicLink.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { issueMagicLink } from "@/lib/magic-link";
import { sendResetEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    // Even malformed input still returns 200 — we don't want a 400 to leak
    // "your address is valid, password is wrong". Just no-op silently.
    return NextResponse.json({ ok: true });
  }

  const cleaned = email.trim().toLowerCase();
  const { data: user } = await supabase
    .from("User")
    .select("id, email, name, isActivated")
    .ilike("email", cleaned)
    .maybeSingle();

  // Send only if user exists AND is activated. Always pretend success.
  if (user && user.isActivated) {
    try {
      const { token } = await issueMagicLink({ userId: user.id, purpose: "reset" });
      await sendResetEmail({ to: user.email, name: user.name, token });
    } catch (err) {
      // Log but don't bubble up — constant-response contract.
      console.error("[forgot-password] failed to issue magic link", err);
    }
  }

  return NextResponse.json({ ok: true });
}
