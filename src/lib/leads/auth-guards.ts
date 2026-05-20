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
