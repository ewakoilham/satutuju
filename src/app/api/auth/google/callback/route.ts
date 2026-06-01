/** GET /api/auth/google/callback
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
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { supabase } from "@/lib/supabase";
import { createToken, getCurrentUser } from "@/lib/auth";
import { exchangeCode, isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { saveConnection } from "@/lib/google-meet";

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
  let mode: "login" | "connect" = "login";
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "satutuju-dev-secret");
    const { payload } = await jwtVerify(state, secret);
    if (typeof payload.next === "string") next = payload.next;
    if (payload.mode === "connect") mode = "connect";
  } catch {
    return NextResponse.redirect(new URL("/login?err=oauth-state", req.url));
  }

  // Exchange code for Google profile.
  let exchangeResult;
  try {
    exchangeResult = await exchangeCode({ code, origin: url.origin });
  } catch (err) {
    console.error("[google/callback] exchange failed", err);
    return NextResponse.redirect(new URL("/login?err=google-exchange", req.url));
  }
  const profile = exchangeResult.profile;

  if (!profile.emailVerified) {
    return NextResponse.redirect(new URL("/login?err=email-unverified", req.url));
  }

  // Connect-mode: user is already logged in via our cookie, just attaching
  // their calendar. We trust the cookie identity and save the refresh token
  // against THAT user, not whoever the Google email maps to. (Prevents a
  // mentor with two Google accounts from accidentally hijacking another
  // user's connection.)
  if (mode === "connect") {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.redirect(new URL("/login?err=connect-no-session", req.url));
    }
    if (!exchangeResult.refreshToken) {
      // Google omitted the refresh token — usually because the user already
      // consented and we forgot `prompt=consent`. Surface a friendly hint.
      const redir = new URL(next, req.url);
      redir.searchParams.set("googleConnect", "no-refresh-token");
      return NextResponse.redirect(redir);
    }
    try {
      await saveConnection({
        userId: me.userId,
        googleSub: profile.sub,
        refreshToken: exchangeResult.refreshToken,
        scopes: exchangeResult.scopes,
      });
    } catch (err) {
      console.error("[google/callback] saveConnection failed", err);
    }
    const redir = new URL(next, req.url);
    redir.searchParams.set("googleConnect", "ok");
    const res = NextResponse.redirect(redir);
    res.cookies.delete("oauth_state");
    return res;
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
      console.error("[google/callback] user insert failed", insErr);
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

  // Save the Google refresh token if Google gave us one — on plain login this
  // only happens the *first* time the user signs in (Google omits it on
  // subsequent silent re-auths). That's fine: if it's missing, we already
  // have whatever scopes were granted on the original login. Calendar scope
  // is granted via the dedicated "Connect Google Calendar" flow (mode=connect).
  if (exchangeResult.refreshToken) {
    try {
      await saveConnection({
        userId: user.id,
        googleSub: profile.sub,
        refreshToken: exchangeResult.refreshToken,
        scopes: exchangeResult.scopes,
      });
    } catch (err) {
      console.error("[google/callback] saveConnection (login) failed", err);
    }
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
