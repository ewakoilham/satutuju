/** GET /api/auth/google-login/callback
 *
 *  Receives Google's redirect with `code` + `state`. Verifies `state` came
 *  from us (matches the cookie we set in ./route.ts and is a valid signed
 *  JWT we issued in the last 10 min), exchanges the code for the Google
 *  profile, then:
 *
 *    - If a User exists with this googleId or email AND is activated:
 *        issue our JWT cookie, redirect to `next` (default /dashboard).
 *    - If the email matches an unredeemed InviteToken:
 *        create the User, link googleId, mark activated, redirect to /welcome.
 *    - Otherwise (outsider trying to walk in):
 *        redirect to /belum-aktif.
 *
 *  This is LOGIN only — it never writes to the GoogleConnection table. The
 *  Calendar refresh-token flow lives behind the separate /api/auth/google
 *  endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { supabase } from "@/lib/supabase";
import { createToken } from "@/lib/auth";
import { exchangeCode, isGoogleOAuthConfigured } from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?err=google-not-configured", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/login?err=oauth-state", req.url));
  }

  // Verify state was issued by us in the last 10 min.
  let next = "/dashboard";
  try {
    const secretValue = process.env.JWT_SECRET;
    if (!secretValue) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    const secret = new TextEncoder().encode(secretValue);
    const { payload } = await jwtVerify(state, secret);
    if (typeof payload.next === "string") next = payload.next;
  } catch {
    return NextResponse.redirect(new URL("/login?err=oauth-state", req.url));
  }

  // Exchange code for Google profile.
  let exchangeResult;
  try {
    exchangeResult = await exchangeCode({ code, origin: url.origin });
  } catch (err) {
    console.error("[google-login/callback] exchange failed", err);
    return NextResponse.redirect(new URL("/login?err=google-exchange", req.url));
  }
  const profile = exchangeResult.profile;

  if (!profile.emailVerified) {
    return NextResponse.redirect(new URL("/login?err=email-unverified", req.url));
  }

  const email = profile.email.toLowerCase();

  // Look up existing user — by googleId first (stable), then email.
  let { data: user } = await supabase
    .from("User")
    .select("id, email, name, role, isActivated, googleId")
    .eq("googleId", profile.sub)
    .maybeSingle();

  if (!user) {
    const { data: byEmail } = await supabase
      .from("User")
      .select("id, email, name, role, isActivated, googleId")
      .eq("email", email)
      .maybeSingle();
    user = byEmail || null;
    // Link this Google identity to the existing local user.
    if (user) {
      await supabase.from("User").update({ googleId: profile.sub }).eq("id", user.id);
    }
  }

  // No matching user — check for an unredeemed invite.
  if (!user) {
    const { data: invite } = await supabase
      .from("InviteToken")
      .select("id, role")
      .eq("email", email)
      .is("usedAt", null)
      .gt("expiresAt", new Date().toISOString())
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return NextResponse.redirect(new URL("/belum-aktif", req.url));
    }

    // Create the user, mark activated. Welcome page renders next.
    const newId = globalThis.crypto.randomUUID();
    const { error: insErr } = await supabase.from("User").insert({
      id: newId,
      email,
      name: profile.name,
      avatar: profile.picture,
      role: invite.role,
      googleId: profile.sub,
      password: null,
      isActivated: true,
      invitedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (insErr) {
      console.error("[google-login/callback] user insert failed", insErr);
      return NextResponse.redirect(new URL("/login?err=user-create", req.url));
    }
    // Burn invite.
    await supabase.from("InviteToken").update({ usedAt: new Date().toISOString() }).eq("id", invite.id);

    user = { id: newId, email, name: profile.name, role: invite.role, isActivated: true, googleId: profile.sub };
    next = "/welcome";
  }

  if (!user.isActivated) {
    return NextResponse.redirect(new URL("/belum-aktif", req.url));
  }

  // Issue our JWT cookie.
  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  res.cookies.delete("oauth_state");
  return res;
}
