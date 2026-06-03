/** Persists each user's Google connection (refresh token + granted scopes).
 *
 *  Written by the Google OAuth callback on login and on the dedicated
 *  "connect calendar" flow. The token is stored so we *could* act on the
 *  user's calendar in the future.
 *
 *  Note: session Meet links are NOT created here. They are created once on the
 *  platform calendar at booking-accept time — see src/lib/google-calendar.ts
 *  (createCalendarEvent) called from /api/schedule/[id]/book. A former
 *  per-mentor `createMeetEvent` path used to also create meetings at
 *  "Mulai sesi" time; it was removed when the platform calendar became the
 *  single source of truth for meetings, eliminating the duplicate-Meet race.
 */

import { supabase } from "@/lib/supabase";

export interface GoogleConnectionRow {
  userId: string;
  googleSub: string;
  refreshToken: string;
  scopes: string;
}

/** Upsert a row in GoogleConnection. Called by the OAuth callback whenever the
 *  user grants any Google scope to us. Scopes are unioned with any previously
 *  granted set so re-consenting for a narrower scope never drops an existing
 *  one. */
export async function saveConnection(opts: {
  userId: string;
  googleSub: string;
  refreshToken: string;
  scopes: string[];
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("GoogleConnection")
    .select("id, scopes")
    .eq("userId", opts.userId)
    .maybeSingle();

  if (existing) {
    const merged = Array.from(
      new Set([...(existing.scopes || "").split(/\s+/).filter(Boolean), ...opts.scopes]),
    ).join(" ");
    await supabase
      .from("GoogleConnection")
      .update({
        googleSub: opts.googleSub,
        refreshToken: opts.refreshToken,
        scopes: merged,
        updatedAt: nowIso,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("GoogleConnection").insert({
      id: globalThis.crypto.randomUUID(),
      userId: opts.userId,
      googleSub: opts.googleSub,
      refreshToken: opts.refreshToken,
      scopes: opts.scopes.join(" "),
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
}
