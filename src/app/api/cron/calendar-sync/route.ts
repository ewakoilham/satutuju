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
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncFromCalendar();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
