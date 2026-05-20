import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncTallySubmissions } from "@/lib/leads/sync-from-tally";

/**
 * Admin-triggered sync. Pulls all submissions from Tally and upserts
 * them into the Lead table.
 *
 * Returns counts so the UI can render a toast: "Synced X new + Y updated".
 *
 * Implementation runs synchronously — at 127 submissions × ~3 round-trips
 * each (lookup, upsert, history/seed), expect 5-20 seconds. Operator
 * clicks the button and waits; that's fine for an on-demand action.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin role required" }, { status: 403 });

  try {
    const result = await syncTallySubmissions();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
