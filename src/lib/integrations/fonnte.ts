import "server-only";

/**
 * Fonnte WhatsApp API client. Fonnte is the WA gateway service Satu Tuju
 * uses to send outbound WhatsApp messages from a verified number.
 *
 * Docs: https://docs.fonnte.com/ (rough — the API surface is tiny)
 * Endpoint: POST https://api.fonnte.com/send
 * Auth: token in `Authorization` header (raw, not Bearer-prefixed)
 *
 * Env var: FONNTE_API_KEY (set in Vercel for production)
 */

const FONNTE_ENDPOINT = "https://api.fonnte.com/send";

export interface SendWhatsappArgs {
  /** Recipient phone in E.164 (e.g. "+6281234567890") or local Indo
   *  format ("0812..."). Normalized to digits-only with leading 62. */
  to: string;
  /** Plain text message body. WA supports basic formatting (*bold*,
   *  _italic_, `code`). No HTML. */
  message: string;
}

export type SendWhatsappResult =
  | { ok: true; messageId: string | null; rawResponse: unknown }
  | { ok: false; error: string };

/** Normalize Indonesian numbers to Fonnte's expected format: digits only
 *  with country code 62 prefix, no plus sign, no spaces, no dashes.
 *  - "+6281234567890" → "6281234567890"
 *  - "081234567890"   → "6281234567890"
 *  - "81234567890"    → "6281234567890"
 *  - "62 812-3456-7890" → "6281234567890"
 */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Local format starting with 0 → swap for 62
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  // Bare local format (no leading 0)
  if (digits.startsWith("8") && digits.length >= 9) return "62" + digits;
  // Already has country code
  if (digits.startsWith("62")) return digits;
  // Foreign number — return as-is, Fonnte may or may not accept
  return digits;
}

export async function sendWhatsapp(args: SendWhatsappArgs): Promise<SendWhatsappResult> {
  const apiKey = process.env.FONNTE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "FONNTE_API_KEY env var not set" };
  }
  const target = normalizeWhatsappNumber(args.to);
  if (!target) {
    return { ok: false, error: "Invalid WhatsApp number (empty after normalization)" };
  }

  let res: Response;
  try {
    const body = new URLSearchParams({
      target,
      message: args.message,
      countryCode: "62",
    });
    res = await fetch(FONNTE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `Fonnte returned non-JSON (HTTP ${res.status})` };
  }

  // Fonnte response shape (rough — depends on plan):
  // success: { status: true, id: ["123"], target: ["6281234567890"], ... }
  // failure: { status: false, reason: "...", ... }
  const obj = json as { status?: boolean; reason?: string; id?: string[]; detail?: string };
  if (!res.ok || obj.status === false) {
    return {
      ok: false,
      error: obj.reason || obj.detail || `Fonnte HTTP ${res.status}`,
    };
  }
  const messageId = Array.isArray(obj.id) && obj.id.length > 0 ? obj.id[0] : null;
  return { ok: true, messageId, rawResponse: json };
}
