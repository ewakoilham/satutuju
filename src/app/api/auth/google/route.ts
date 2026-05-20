import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/integrations/google-calendar";

/**
 * Initiate the Google OAuth dance to authorize the app to read
 * admin@satutuju.id's calendar. Admin-gated — only the admin doing the
 * one-time setup should hit this. Generates a CSRF-style state token,
 * sets it as a cookie, and 302-redirects to Google's consent page.
 *
 * Flow:
 *   GET /api/auth/google  →  302 to accounts.google.com/...
 *   Google consent screen
 *   →  302 to /api/auth/google/callback?code=...&state=...
 *   →  callback handler exchanges code for tokens + stores refresh_token
 */
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  // CSRF-style state token. Verified in the callback to ensure the
  // redirect we receive is the one we sent.
  const state = crypto.randomBytes(16).toString("hex");

  try {
    const authUrl = buildAuthUrl(state);
    const res = NextResponse.redirect(authUrl);
    res.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build auth URL" },
      { status: 500 },
    );
  }
}
