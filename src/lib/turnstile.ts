/** Cloudflare Turnstile CAPTCHA — server-side verify.
 *
 *  After 5+ failed logins, the rate limiter requires the client to include
 *  a Turnstile token (collected via the Turnstile widget on the login form).
 *  This module verifies that token against Cloudflare's API.
 *
 *  Falls back to "always pass" if TURNSTILE_SECRET_KEY isn't set, so local
 *  dev without keys still works. Production env var presence is enforced by
 *  deploy-time check (not in this module).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(opts: {
  token: string | null | undefined;
  ip?: string;
}): Promise<boolean> {
  if (!isTurnstileConfigured()) {
    // Dev fallback: log loudly so we notice in CI but don't block local work.
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — auto-passing CAPTCHA check");
    return true;
  }
  if (!opts.token) return false;

  const form = new FormData();
  form.append("secret", process.env.TURNSTILE_SECRET_KEY!);
  form.append("response", opts.token);
  if (opts.ip) form.append("remoteip", opts.ip);

  try {
    const r = await fetch(VERIFY_URL, { method: "POST", body: form });
    const j = (await r.json()) as { success: boolean; "error-codes"?: string[] };
    return Boolean(j.success);
  } catch (err) {
    console.error("[turnstile] verify failed", err);
    return false;
  }
}
