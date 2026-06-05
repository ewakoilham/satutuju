/**
 * Stale-while-revalidate cache for the mentee's pairing detail
 * (`/api/pairings/me`), shared across Beranda + Dokumen so switching between
 * those tabs is instant on revisit.
 *
 * Consistency rules (deliberate, to avoid stale-state bugs):
 *  - Callers render the cached value immediately, but ALWAYS kick off a
 *    background refetch on mount — so any staleness self-corrects within ~1 req.
 *  - Mutations (task toggle, doc upload, comment) call `invalidateMenteePairing()`
 *    so the next read refetches fresh.
 *  - This ONLY caches pairing data (sessions / tasks / documents / mentor /
 *    mentee profile). Auth, contract-signature status, and the contract banner
 *    are fetched separately and are NOT cached here — so e.g. "signed the
 *    contract but dashboard still shows unsigned" cannot happen.
 *  - Module-scoped: lives for the SPA session, cleared on a full page reload.
 */

// `undefined` = never loaded; `null` = loaded, no pairing; object = loaded.
let cache: unknown | undefined = undefined;
let inflight: Promise<unknown> | null = null;

/** Synchronously read the cached pairing. Returns `undefined` if never loaded. */
export function getCachedMenteePairing(): unknown | undefined {
  return cache;
}

/** Fetch (or join an in-flight fetch) and update the cache. */
export function refreshMenteePairing(): Promise<unknown> {
  if (inflight) return inflight;
  inflight = fetch("/api/pairings/me")
    .then((r) => (r.ok ? r.json() : { pairing: null }))
    .then((d) => {
      cache = d?.pairing ?? null;
      return cache;
    })
    .catch(() => cache ?? null) // keep last-known value on network error
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cache so the next refresh hits the network. Call after mutations. */
export function invalidateMenteePairing(): void {
  cache = undefined;
  inflight = null;
}
