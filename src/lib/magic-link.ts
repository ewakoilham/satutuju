/** Magic-link tokens: one-time, time-limited links emailed to the user for
 *  password reset and (later) passwordless sign-in.
 *
 *  Threat model:
 *  - Token must be unguessable → 32 random bytes, base64url.
 *  - Token must not be reusable → DB row burns on first redemption.
 *  - DB compromise must not yield usable tokens for in-flight users → we
 *    store SHA-256(token) instead of the raw token. The raw token is only
 *    ever sent in the email.
 */

import { createHash, randomBytes } from "node:crypto";
import { supabase } from "@/lib/supabase";

export type MagicPurpose = "reset" | "passwordless";

const RAW_TOKEN_BYTES = 32;
const EXPIRY_MS = 24 * 60 * 60_000; // 24h per the v5 design

/** Issue a fresh magic link. Returns the RAW token (to embed in URL).
 *  The DB stores only the hash. */
export async function issueMagicLink(opts: {
  userId: string;
  purpose: MagicPurpose;
}): Promise<{ token: string; expiresAt: Date }> {
  const raw = randomBytes(RAW_TOKEN_BYTES).toString("base64url");
  const tokenHash = hash(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  const { error } = await supabase.from("MagicLink").insert({
    id: globalThis.crypto.randomUUID(),
    userId: opts.userId,
    purpose: opts.purpose,
    token: tokenHash,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to issue magic link: ${error.message}`);

  return { token: raw, expiresAt };
}

/** Consume a raw token. Returns the underlying record (with userId + purpose)
 *  on success, null when token is invalid / expired / already used. The DB
 *  row is marked `usedAt` atomically so the same token can't be redeemed
 *  twice. */
export async function consumeMagicLink(rawToken: string): Promise<{
  userId: string;
  purpose: MagicPurpose;
} | null> {
  const tokenHash = hash(rawToken);
  const nowIso = new Date().toISOString();

  // Atomic: only mark used if not already used and not expired.
  const { data, error } = await supabase
    .from("MagicLink")
    .update({ usedAt: nowIso })
    .eq("token", tokenHash)
    .is("usedAt", null)
    .gt("expiresAt", nowIso)
    .select("userId, purpose")
    .maybeSingle();

  if (error || !data) return null;
  return { userId: data.userId, purpose: data.purpose as MagicPurpose };
}

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
