import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Fail closed: never fall back to a hardcoded key. Must match the secret
// used in src/lib/auth.ts to sign tokens; a known fallback here would let
// anyone forge a valid admin JWT.
const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET = new TextEncoder().encode(rawJwtSecret);

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Check Supabase directly via REST — works on Edge runtime (no Node.js required)
async function mentorProfileFilled(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/MentorProfile?userId=eq.${encodeURIComponent(userId)}&select=fullName,mentorStyle&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store" }
    );
    if (!res.ok) return true; // On error, let through rather than lock out
    const rows: Array<{ fullName?: string; mentorStyle?: string }> = await res.json();
    return rows.length > 0 && !!rows[0].fullName && !!rows[0].mentorStyle;
  } catch {
    return true;
  }
}

async function menteeProfileFilled(userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/MenteeProfile?userId=eq.${encodeURIComponent(userId)}&select=fullLegalName&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: "no-store" }
    );
    if (!res.ok) return true;
    const rows: Array<{ fullLegalName?: string }> = await res.json();
    return rows.length > 0 && !!rows[0].fullLegalName;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Signed-in users hitting /login get bounced to /dashboard (no point seeing
  // the login form when already authenticated). The landing page (/) stays
  // public for everyone — anonymous and signed-in alike.
  if (pathname === "/login") {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.next();
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } catch {
      // Invalid/expired token — let them see the page normally
      return NextResponse.next();
    }
  }

  // Only run on dashboard routes
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  // Never gate the onboarding pages themselves (would cause infinite redirect)
  if (
    pathname.startsWith("/dashboard/onboarding") ||
    pathname.startsWith("/dashboard/mentor-onboarding")
  ) {
    return NextResponse.next();
  }

  // Verify JWT
  const token = req.cookies.get("token")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  let role: string;
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    role   = payload.role   as string;
    userId = payload.userId as string;
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admins are never gated
  if (role === "admin") return NextResponse.next();

  // ── Mentor gate ────────────────────────────────────────────────────────────
  if (role === "mentor") {
    // Fast path: cookie from a previous successful check
    if (req.cookies.get("mentor_onboarded")?.value === "1") return NextResponse.next();

    const filled = await mentorProfileFilled(userId);
    if (!filled) {
      return NextResponse.redirect(new URL("/dashboard/mentor-onboarding", req.url));
    }
    // Cache the result for 7 days so we don't hit Supabase on every request
    const res = NextResponse.next();
    res.cookies.set("mentor_onboarded", "1", { path: "/", maxAge: 7 * 24 * 60 * 60, sameSite: "strict" });
    return res;
  }

  // ── Mentee gate ────────────────────────────────────────────────────────────
  if (role === "mentee") {
    if (req.cookies.get("mentee_onboarded")?.value === "1") return NextResponse.next();

    const filled = await menteeProfileFilled(userId);
    if (!filled) {
      return NextResponse.redirect(new URL("/dashboard/onboarding", req.url));
    }
    const res = NextResponse.next();
    res.cookies.set("mentee_onboarded", "1", { path: "/", maxAge: 7 * 24 * 60 * 60, sameSite: "strict" });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
