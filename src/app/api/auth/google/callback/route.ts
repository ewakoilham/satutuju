import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exchangeCodeForTokens, saveAuth } from "@/lib/integrations/google-calendar";

/**
 * OAuth callback handler. Google redirects here after the admin grants
 * consent on Google's domain. Validates the CSRF state cookie, exchanges
 * `code` for tokens, and persists the long-lived refresh_token into the
 * GoogleCalendarAuth singleton row.
 *
 * On success: redirect back to /dashboard/admin/new-leads with a
 * ?google=connected query so the UI can show a success toast.
 * On failure: redirect with ?google=error&reason=...
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  // User clicked "Cancel" on Google consent.
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/new-leads?google=error&reason=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/admin/new-leads?google=error&reason=missing_params", req.url),
    );
  }
  // CSRF guard.
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/admin/new-leads?google=error&reason=state_mismatch", req.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveAuth({
      refreshToken: tokens.refresh_token,
      scope: tokens.scope,
      googleEmail: tokens.email,
      connectedBy: user.userId,
    });

    const res = NextResponse.redirect(
      new URL(
        `/dashboard/admin/new-leads?google=connected&email=${encodeURIComponent(tokens.email ?? "")}`,
        req.url,
      ),
    );
    // Clear the one-shot CSRF cookie.
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/dashboard/admin/new-leads?google=error&reason=${encodeURIComponent(msg)}`, req.url),
    );
  }
}
