/** GET /api/auth/google-login
 *
 *  Initiates the Google OAuth dance for LOGIN: signs a fresh `state` (HMAC of
 *  a random nonce + optional next-url), stores it in a short-lived cookie,
 *  and 302s to the Google consent URL. Callback is in ./callback/route.ts.
 *
 *  Identity-only scopes (LOGIN_SCOPES). Calendar connection lives behind the
 *  separate /api/auth/google (Calendar) flow and is NOT touched here.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { SignJWT } from "jose";
import { buildAuthUrl, isGoogleOAuthConfigured, LOGIN_SCOPES } from "@/lib/google-oauth";

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

  // State = signed JWT with nonce + intended redirect. Verified in callback.
  const secretValue = process.env.JWT_SECRET;
  if (!secretValue) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  const nonce = crypto.randomBytes(16).toString("base64url");
  const secret = new TextEncoder().encode(secretValue);
  const state = await new SignJWT({ nonce, next })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  const authUrl = buildAuthUrl({
    origin,
    state,
    scopes: LOGIN_SCOPES,
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
