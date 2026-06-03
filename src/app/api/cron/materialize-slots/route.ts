/** Daily cron: roll the recurring-availability window forward.
 *
 *  GET /api/cron/materialize-slots
 *
 *  Re-materializes every mentor with active rules so that as days pass, the
 *  far edge of the 8-week horizon keeps getting filled (and past/orphaned
 *  available slots get cleaned up). Idempotent — safe to run as often as you
 *  like; once a day is plenty.
 *
 *  Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when the
 *  CRON_SECRET env var is set. We require it. Configure the schedule in
 *  vercel.json.
 */

import { NextRequest, NextResponse } from "next/server";
import { materializeAllMentors } from "@/lib/availability-cascade";

// Always run on-demand; never cache.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await materializeAllMentors();
  return NextResponse.json({ ok: true, ...summary });
}
