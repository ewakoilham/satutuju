import "server-only";

import { google, type calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "@/lib/supabase";
import { GOOGLE_CALENDAR_AUTH_COLUMNS } from "@/lib/db-columns";

/**
 * Google Calendar integration — tracks lead bookings on Razak's
 * appointment-schedule calendar (`admin@satutuju.id`). Auth is OAuth
 * 2.0 user-flow with a long-lived refresh token persisted in the
 * `GoogleCalendarAuth` singleton DB row.
 *
 * Flow at runtime:
 *   1. Cron / admin trigger → loadAuth() pulls refresh_token from DB
 *   2. Exchange refresh_token → access_token via OAuth2 client
 *   3. Call Google Calendar API to list events updated since lastSyncAt
 *   4. Match attendee emails to Lead.email → advance stage
 */

/** Full calendar scope — needed because the schedule-booking flow in
 *  /api/schedule/[id]/book creates events with Meet links (read-write).
 *  The leads-tracking sync only reads, but we share one OAuth grant so
 *  both flows use the same refresh token. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar openid email";

/** Construct an OAuth client. Env vars must be set. */
export function makeOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth env vars missing (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Build the consent URL the admin opens to authorize the app. */
export function buildAuthUrl(state: string): string {
  const oauth = makeOAuthClient();
  return oauth.generateAuthUrl({
    access_type: "offline",       // get refresh_token, not just access_token
    prompt: "consent",            // force consent so refresh_token is returned every time
    scope: GOOGLE_CALENDAR_SCOPE.split(" "),
    state,
  });
}

/** Exchange the OAuth callback code for tokens + user info. */
export async function exchangeCodeForTokens(code: string): Promise<{
  refresh_token: string;
  access_token: string;
  scope: string;
  email: string | null;
}> {
  const oauth = makeOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token — the user may have authorized this app before. Revoke at https://myaccount.google.com/permissions and retry.");
  }
  if (!tokens.access_token) {
    throw new Error("Google did not return an access_token");
  }

  // Fetch the connected account's email so admin UI can show "Connected as admin@satutuju.id"
  oauth.setCredentials(tokens);
  let email: string | null = null;
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { email?: string };
      email = data.email ?? null;
    }
  } catch {
    // Best-effort; ignore.
  }

  return {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPE,
    email,
  };
}

export interface GoogleCalendarAuthRow {
  id: string;
  refreshToken: string;
  scope: string;
  googleEmail: string | null;
  connectedAt: string;
  connectedBy: string | null;
  lastSyncAt: string | null;
  lastSyncToken: string | null;
  updatedAt: string;
}

/** Load the singleton auth row. Returns null when nobody has connected yet. */
export async function loadAuth(): Promise<GoogleCalendarAuthRow | null> {
  const { data, error } = await supabase
    .from("GoogleCalendarAuth")
    .select(GOOGLE_CALENDAR_AUTH_COLUMNS)
    .eq("id", "singleton")
    .single();
  if (error || !data) return null;
  return data as unknown as GoogleCalendarAuthRow;
}

/** Upsert the singleton auth row after a successful OAuth dance. */
export async function saveAuth(params: {
  refreshToken: string;
  scope: string;
  googleEmail: string | null;
  connectedBy: string;
}): Promise<void> {
  const now = new Date().toISOString();
  // Upsert (insert or update on PK conflict). PostgREST treats "Prefer:
  // resolution=merge-duplicates" as upsert, but supabase-js's `upsert`
  // method is cleaner.
  const { error } = await supabase
    .from("GoogleCalendarAuth")
    .upsert({
      id: "singleton",
      refreshToken: params.refreshToken,
      scope: params.scope,
      googleEmail: params.googleEmail,
      connectedAt: now,
      connectedBy: params.connectedBy,
      updatedAt: now,
    }, { onConflict: "id" });
  if (error) throw new Error("Failed to save GoogleCalendarAuth: " + error.message);
}

/** Construct an authenticated Calendar API client using the stored refresh token. */
export function makeAuthedClient(refreshToken: string): calendar_v3.Calendar {
  const oauth = makeOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth });
}
