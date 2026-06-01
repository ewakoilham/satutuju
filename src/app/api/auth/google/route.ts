/** GET /api/auth/google
 *
 *  Initiates the Google OAuth dance: signs a fresh `state` (HMAC of a
 *  random nonce + optional next-url), stores it in a short-lived cookie,
 *  and 302s to the Google consent URL. Callback is in ./callback/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { SignJWT } from "jose";
import { buildAuthUrl, isGoogleOAuthConfigured, LOGIN_SCOPES, CALENDAR_SCOPES } from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google login belum dikonfigurasi. Hubungi admin." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const next = url.searchParams.get("next") || "/dashboard";
  // mode=connect → user is already logged in; we're just asking for the
  // calendar scope. mode=login (default) → identity-only scopes.
  const mode = url.searchParams.get("mode") === "connect" ? "connect" : "login";

  // State = signed JWT with nonce + intended redirect + mode. Verified in callback.
  const nonce = crypto.randomBytes(16).toString("base64url");
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "satutuju-dev-secret",
  );
  const state = await new SignJWT({ nonce, next, mode })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  const scopes =
    mode === "connect"
      ? [...LOGIN_SCOPES, ...CALENDAR_SCOPES]
      : LOGIN_SCOPES;

  const authUrl = buildAuthUrl({
    origin,
    state,
    scopes,
    // Force the consent screen when connecting so we always get a refresh token
    // back (Google omits it on silent re-auth) AND the user explicitly opts
    // into the new calendar scope.
    forceConsent: mode === "connect",
  });
  const res = NextResponse.redirect(authUrl, { status: 302 });
  // Echo the state in a cookie too so we can double-check on the callback.
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
