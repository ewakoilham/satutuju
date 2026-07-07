/**
 * Idle-time cache warmer: once the dashboard shell knows the user's role,
 * quietly prefetch the data behind the OTHER main tabs into the swr-lite /
 * mentee caches — so clicking Beranda ⇄ Mentee ⇄ Jadwal ⇄ Leads paints
 * instantly instead of showing a skeleton while the API (and its serverless
 * cold start) is paid for in front of the user.
 *
 * Rules:
 *  - runs once per SPA session (module flag)
 *  - waits for idle so it never competes with the current page's own fetches
 *  - respects Data Saver
 *  - only warms URLs that pages actually READ through the caches
 */

import { revalidate } from "@/lib/swr-lite";
import { refreshMenteePairing } from "@/lib/mentee-pairing-cache";

let warmed = false;

export function warmDashboardCaches(role: string | undefined | null): void {
  if (warmed || !role || typeof window === "undefined") return;
  warmed = true;

  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return;

  const kick = () => {
    if (role === "mentor") {
      void revalidate("/api/pairings");
      void revalidate("/api/schedule");
      // Matches the Leads page's default query key exactly.
      void revalidate("/api/mentor/leads?limit=200");
    } else if (role === "mentee") {
      void refreshMenteePairing();
      void revalidate("/api/schedule");
    } else {
      // admin
      void revalidate("/api/pairings");
      void revalidate("/api/schedule");
    }
  };

  type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  const w = window as IdleWindow;
  if (w.requestIdleCallback) w.requestIdleCallback(kick, { timeout: 4000 });
  else setTimeout(kick, 1500);
}
