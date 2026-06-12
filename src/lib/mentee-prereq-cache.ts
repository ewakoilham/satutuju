/**
 * Phase 19 — deduped fetch for the mentee's onboarding prerequisites
 * (contract signature + deposit proof), both served by
 * `GET /api/mentee-contract?summary=1`.
 *
 * The dashboard banner (DashboardContractAlert) and the hard gate
 * (MenteePrereqGate) both mount on the same navigation; this helper makes
 * them share ONE request via an in-flight join plus a short TTL, while
 * staying fresh per navigation (unlike the session-long pairing cache in
 * `mentee-pairing-cache.ts`).
 */

import type { DepositSummary } from "@/lib/deposit-terms";

export interface MenteePrereqState {
  contract: { status: string; templateVersion: string } | null;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  needsResign: boolean;
  deposit: DepositSummary | null;
}

const TTL_MS = 3_000;

let cache: MenteePrereqState | null = null;
let cachedAt = 0;
let inflight: Promise<MenteePrereqState | null> | null = null;

/** Fetch (or join an in-flight fetch / fresh cache) the prereq state. */
export function fetchMenteePrereqs(): Promise<MenteePrereqState | null> {
  if (cache && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch("/api/mentee-contract?summary=1", {
    credentials: "include",
    cache: "no-store",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: MenteePrereqState | null) => {
      if (d) {
        cache = d;
        cachedAt = Date.now();
      }
      return d;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Drop the cache so the next read refetches. Call after upload/sign. */
export function invalidateMenteePrereqs(): void {
  cache = null;
  cachedAt = 0;
  inflight = null;
}

/**
 * Contract prerequisite: a SIGNED contract opens the gate even when its
 * template version is stale — re-sign nagging stays banner-only.
 */
export function isContractOk(s: MenteePrereqState): boolean {
  return s.contract?.status === "SIGNED";
}

/** Deposit prerequisite: open from the moment a proof is uploaded. */
export function isDepositOk(s: MenteePrereqState): boolean {
  return s.deposit?.status === "UPLOADED" || s.deposit?.status === "VERIFIED";
}
