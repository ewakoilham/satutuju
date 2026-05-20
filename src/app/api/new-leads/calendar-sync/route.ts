import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncFromCalendar } from "@/lib/leads/sync-from-calendar";

/**
 * Admin-triggered Google Calendar sync. Mirrors /api/new-leads/sync for
 * Tally — same pattern, same UI button affordance ("Sync from Calendar").
 */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }

  const result = await syncFromCalendar();
  if (!result.ok) {
    return NextResponse.json(result, { status: result.authConnected ? 500 : 412 });
  }
  return NextResponse.json(result);
}
