/**
 * Tiny stale-while-revalidate cache keyed by URL, for read-mostly dashboard
 * data shared across tabs (mentor Beranda + Mentee list share /api/pairings
 * and /api/schedule).
 *
 * Usage: render `getCached(url)` instantly, then call `revalidate(url)` on mount
 * to refresh in the background. Call `invalidate(url)` after a mutation so the
 * next read refetches fresh.
 *
 * Do NOT cache auth, contract-signature status, or profile-completeness here —
 * those must always be fresh (e.g. "signed the contract" must reflect instantly).
 * Module-scoped: lives for the SPA session, cleared on a full reload.
 */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Synchronous cache read. `undefined` = never loaded. */
export function getCached<T = unknown>(url: string): T | undefined {
  return cache.has(url) ? (cache.get(url) as T) : undefined;
}

/** Fetch `url` (or join an in-flight fetch), cache the JSON, and return it. */
export function revalidate<T = unknown>(url: string): Promise<T> {
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      cache.set(url, d);
      return d;
    })
    .catch(() => (cache.has(url) ? cache.get(url) : null)) // keep last-known on error
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, p);
  return p as Promise<T>;
}

/** Drop cached entries so the next revalidate hits the network. Call after mutations. */
export function invalidate(...urls: string[]): void {
  for (const u of urls) {
    cache.delete(u);
    inflight.delete(u);
  }
}
