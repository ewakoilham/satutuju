import { NextRequest, NextResponse } from "next/server";
import { syncTallySubmissions } from "@/lib/leads/sync-from-tally";
import { sendAdminNewLeadsEmail } from "@/lib/email-templates";

/**
 * Vercel Cron-triggered Tally sync. Configured in vercel.json.
 *
 * Auth: Vercel attaches `Authorization: Bearer <CRON_SECRET>` to cron
 * invocations. We verify against the env var so this can't be hit by
 * randos.
 *
 * Body: empty. Returns same SyncResult shape as the admin endpoint.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[tally-sync] CRON_SECRET not set");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Incremental: stop at the first already-synced submission so a
    // steady-state tick is one Tally page + one batched existence check.
    const result = await syncTallySubmissions({ incremental: true });
    // Log so Vercel function logs show the outcome of each tick.
    console.log(
      `[tally-sync] synced ${result.total} total / created ${result.created} / updated ${result.updated} / skipped ${result.skipped} / errors ${result.errors.length}`,
    );
    // One digest per tick when new leads landed — only from the cron, so the
    // admin's manual "Sync" button doesn't email them about what's on screen.
    if (result.created > 0) {
      await sendAdminNewLeadsEmail({ count: result.created, names: result.createdNames });
    }
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[tally-sync] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
