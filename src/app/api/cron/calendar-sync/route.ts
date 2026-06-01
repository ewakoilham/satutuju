import { NextRequest, NextResponse } from "next/server";
import { syncFromCalendar } from "@/lib/leads/sync-from-calendar";

/**
 * Vercel cron endpoint. Vercel sets a Bearer header so we can verify
 * the request actually came from Vercel's cron scheduler (otherwise
 * anyone on the internet could trigger sync).
 *
 * Schedule defined in vercel.json — every 15 minutes for near-realtime
 * booking detection without hammering Google's quota.
 */
export async function GET(req: NextRequest) {
  // Fail closed: refuse if CRON_SECRET is unset rather than running
  // unauthenticated (otherwise anyone could trigger sync + DB load).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[calendar-sync] CRON_SECRET not set");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncFromCalendar();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
