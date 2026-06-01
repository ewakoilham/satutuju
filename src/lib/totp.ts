/** TOTP (Authenticator-app two-factor) helpers.
 *
 *  Wraps `otpauth` for code generation/verification. Secrets are encrypted
 *  at rest with AES-256-GCM keyed off MAGIC_LINK_SECRET so that a DB dump
 *  doesn't immediately yield bypassable codes.
 *
 *  Lifecycle:
 *    1. Setup: server generates secret → returns provisioning URI + QR data
 *       URL. Row stored with verified=false.
 *    2. User scans QR with Authenticator, types first code → server verifies
 *       and flips verified=true. From this point, login requires a TOTP code.
 *    3. Login: when User.twoFactorEnabled, login route asks for code after
 *       password check. Code is verified against the stored (decrypted)
 *       secret with a ±1 window.
 */

import * as crypto from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { toDataURL } from "qrcode";
import { supabase } from "@/lib/supabase";

const ISSUER = "Satu Tuju";
const KEY_DERIVE_SALT = "satutuju-totp-v1";

function deriveKey(): Buffer {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    throw new Error("MAGIC_LINK_SECRET not set — required for TOTP encryption");
  }
  // 32-byte AES-256 key via SHA-256(secret + salt).
  return crypto.createHash("sha256").update(secret + KEY_DERIVE_SALT).digest();
}

function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

function decryptSecret(blob: string): string {
  const key = deriveKey();
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Begin enrollment: create a new (or replace existing unverified) TOTP
 *  secret for the user, return otpauth URI + QR image data URL. */
export async function setupTotp(opts: {
  userId: string;
  email: string;
}): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: ISSUER,
    label: opts.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  const otpauthUrl = totp.toString();
  const qrDataUrl = await toDataURL(otpauthUrl, { width: 240, margin: 1 });

  const encrypted = encryptSecret(secret.base32);
  // Upsert: replace any existing unverified row.
  await supabase
    .from("TotpSecret")
    .delete()
    .eq("userId", opts.userId)
    .eq("verified", false);
  await supabase.from("TotpSecret").insert({
    id: globalThis.crypto.randomUUID(),
    userId: opts.userId,
    secret: encrypted,
    verified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { otpauthUrl, qrDataUrl };
}

/** Verify the first code from the user during enrollment. On success the
 *  secret is marked verified and User.twoFactorEnabled flips to true. */
export async function verifyTotpEnrollment(opts: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const { data: row } = await supabase
    .from("TotpSecret")
    .select("id, secret")
    .eq("userId", opts.userId)
    .eq("verified", false)
    .maybeSingle();
  if (!row) return false;
  const ok = verifyCode(row.secret, opts.code);
  if (!ok) return false;
  await supabase
    .from("TotpSecret")
    .update({ verified: true, updatedAt: new Date().toISOString() })
    .eq("id", row.id);
  await supabase
    .from("User")
    .update({ twoFactorEnabled: true })
    .eq("id", opts.userId);
  return true;
}

/** Login-time verification: pull the user's verified secret and check the
 *  submitted code. */
export async function verifyTotpLogin(opts: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const { data: row } = await supabase
    .from("TotpSecret")
    .select("secret")
    .eq("userId", opts.userId)
    .eq("verified", true)
    .maybeSingle();
  if (!row) return false;
  return verifyCode(row.secret, opts.code);
}

function verifyCode(encryptedSecret: string, code: string): boolean {
  const secret = Secret.fromBase32(decryptSecret(encryptedSecret));
  const totp = new TOTP({ issuer: ISSUER, secret, digits: 6, period: 30 });
  // ±1 window of 30s tolerates a small amount of clock drift.
  const delta = totp.validate({ token: code.trim(), window: 1 });
  return delta !== null;
}
