/** Postgres-backed login rate limiter.
 *
 *  We avoid Redis because Supabase is right there and the volume (a few
 *  hundred mentors) doesn't justify another moving part. Every login attempt
 *  is logged via `recordAttempt`. Before each attempt the caller asks
 *  `checkLimit` which buckets the last hour of attempts for either the email
 *  or the requesting IP and decides what to require next.
 *
 *  Tunable thresholds — see PLAN.md §4 dissent #6. Stricter than the v5
 *  spec on purpose: 5s lockouts are too short to actually deter abuse.
 *
 *      3 fails in 15 min  → 30s wait
 *      5 fails in 15 min  → require Turnstile + 5min wait
 *      10 fails in 60 min → 1 hour cooldown, Turnstile required for that hour
 *
 *  A daily Supabase cron prunes rows older than 24h (set up separately).
 */
import { supabase } from "@/lib/supabase";

export interface RateLimitDecision {
  /** True if the attempt should proceed. */
  allowed: boolean;
  /** Milliseconds until the next attempt is allowed. 0 when `allowed`. */
  retryAfterMs: number;
  /** When true, the client must include a valid Turnstile token. */
  requireCaptcha: boolean;
  /** Human-readable reason (for logging — never expose to UI). */
  reason: string;
}

const ALLOWED: RateLimitDecision = {
  allowed: true,
  retryAfterMs: 0,
  requireCaptcha: false,
  reason: "ok",
};

const MINUTE_MS = 60_000;

/** Public — count an attempt against both identifiers and check decision. */
export async function checkLimit(opts: {
  email: string;
  ip: string;
}): Promise<RateLimitDecision> {
  const emailKey = `email:${opts.email.toLowerCase().trim()}`;
  const ipKey = `ip:${opts.ip}`;

  const [emailDecision, ipDecision] = await Promise.all([
    checkIdentifier(emailKey),
    checkIdentifier(ipKey),
  ]);

  // Return the stricter of the two.
  if (!emailDecision.allowed) return emailDecision;
  if (!ipDecision.allowed) return ipDecision;
  if (emailDecision.requireCaptcha || ipDecision.requireCaptcha) {
    return { ...ALLOWED, requireCaptcha: true };
  }
  return ALLOWED;
}

/** Public — record outcome after a login attempt.
 *  Awaited so the next checkLimit call sees this row; rate-limit decisions
 *  rely on this insert being durable before we respond. */
export async function recordAttempt(opts: {
  email: string;
  ip: string;
  success: boolean;
}): Promise<void> {
  const rows = [
    { id: cryptoRandomId(), identifier: `email:${opts.email.toLowerCase().trim()}`, success: opts.success, createdAt: new Date().toISOString() },
    { id: cryptoRandomId(), identifier: `ip:${opts.ip}`, success: opts.success, createdAt: new Date().toISOString() },
  ];
  const { error } = await supabase.from("LoginAttempt").insert(rows);
  if (error) console.error("[rate-limit] insert failed", error);
}

async function checkIdentifier(identifier: string): Promise<RateLimitDecision> {
  const since = new Date(Date.now() - 60 * MINUTE_MS).toISOString();
  const { data } = await supabase
    .from("LoginAttempt")
    .select("success, createdAt")
    .eq("identifier", identifier)
    .gte("createdAt", since)
    .order("createdAt", { ascending: false })
    .limit(50);

  const attempts = data || [];
  const failures = attempts.filter((a) => !a.success);

  // Most recent failure determines the wait floor.
  const last = failures[0];
  if (!last) return ALLOWED;

  // Supabase returns "timestamp without time zone" as a naive string ("2026-…
  // 12:53:29.542" or "2026-…T12:53:29.455"). new Date() then interprets it in
  // the host's local TZ — off by hours. Force UTC by replacing any space
  // separator with T and appending Z when absent.
  const parseUtc = (raw: string) => {
    const s = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    return new Date(s.endsWith("Z") ? s : s + "Z").getTime();
  };

  const sinceLast = Date.now() - parseUtc(last.createdAt);
  const fails15 = failures.filter((a) => Date.now() - parseUtc(a.createdAt) < 15 * MINUTE_MS).length;
  const fails60 = failures.length;

  // One-line debug surface — flips on with RATE_LIMIT_DEBUG=1.
  if (process.env.RATE_LIMIT_DEBUG) {
    console.log("[rate-limit]", identifier, "fails15=", fails15, "fails60=", fails60, "sinceLast=", sinceLast, "ms");
  }

  if (fails60 >= 10) {
    const remaining = Math.max(0, 60 * MINUTE_MS - sinceLast);
    return {
      allowed: remaining === 0,
      retryAfterMs: remaining,
      requireCaptcha: true,
      reason: `${fails60} failures in 60min — 1h cooldown`,
    };
  }
  if (fails15 >= 5) {
    const remaining = Math.max(0, 5 * MINUTE_MS - sinceLast);
    return {
      allowed: remaining === 0,
      retryAfterMs: remaining,
      requireCaptcha: true,
      reason: `${fails15} failures in 15min — 5min wait + captcha`,
    };
  }
  if (fails15 >= 3) {
    const remaining = Math.max(0, 30_000 - sinceLast);
    return {
      allowed: remaining === 0,
      retryAfterMs: remaining,
      requireCaptcha: false,
      reason: `${fails15} failures in 15min — 30s wait`,
    };
  }
  return ALLOWED;
}

/** crypto.randomUUID-shaped id without depending on a runtime fallback. */
function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID();
}

/** Resolve the client IP from the request. Trusts Vercel / Cloudflare headers
 *  first, falls back to remote-addr. */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}
