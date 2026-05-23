import { NextResponse } from "next/server";
import { getCurrentUser, type JWTPayload } from "@/lib/auth";

/**
 * Admin route guard. Use at the top of every admin-only API route:
 *
 *   const guard = await requireAdmin();
 *   if (guard.error) return guard.error;
 *   const user = guard.user;
 *
 * Returns the resolved user OR a ready-to-return NextResponse with the
 * correct 401/403 status. Centralizes the boilerplate that was copied
 * verbatim across ~20 routes.
 */
export async function requireAdmin(): Promise<
  { user: JWTPayload; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      error: NextResponse.json({ error: "Admin role required" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

/**
 * Mentor route guard. Mirror of requireAdmin() for routes that should
 * accept only role="mentor". Used by Phase 13 mentor-side leads
 * endpoints so admin tokens (read-write power) and mentee tokens
 * can't accidentally hit the mentor-scoped surface.
 */
export async function requireMentor(): Promise<
  { user: JWTPayload; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.role !== "mentor") {
    return {
      user: null,
      error: NextResponse.json({ error: "Mentor role required" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

/** Either-or guard for endpoints both admin and mentor can hit
 *  (the shared /api/lead-notes thread). Role differentiation happens
 *  in the route logic. */
export async function requireAdminOrMentor(): Promise<
  { user: JWTPayload; error: null } | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (user.role !== "admin" && user.role !== "mentor") {
    return {
      user: null,
      error: NextResponse.json({ error: "Admin or mentor role required" }, { status: 403 }),
    };
  }
  return { user, error: null };
}
