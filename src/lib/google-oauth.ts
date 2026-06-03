/** Google OAuth helpers — used by /login (identity-only scopes) and by the
 *  Sesi "Mulai sesi" flow (calendar.events scope, deferred to Phase D).
 *
 *  The same OAuth Client ID handles both surfaces; we just request different
 *  scopes per surface. Calendar consent is requested on demand the first
 *  time the mentor presses "Mulai sesi", not at login time.
 *
 *  All flows use the Authorization Code grant with PKCE for SPA safety
 *  (state + nonce stored in a short-lived signed cookie).
 */

import { OAuth2Client } from "google-auth-library";

const REDIRECT_PATH = "/api/auth/google-login/callback";

export const LOGIN_SCOPES = [
  "openid",
  "email",
  "profile",
];

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

function getClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleOAuthNotConfigured();
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export class GoogleOAuthNotConfigured extends Error {
  constructor() {
    super("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not set in .env");
    this.name = "GoogleOAuthNotConfigured";
  }
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export interface GoogleProfile {
  sub: string;          // stable user id from Google
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/** Build the URL to redirect users to for consent. Caller is responsible for
 *  signing & storing the `state` (we recommend HMAC of a nonce + redirect
 *  intent).
 *
 *  When `forceConsent` is true (used by the "Connect Google Calendar" flow,
 *  not by plain login), we force the consent screen even if the user has
 *  previously approved — this is how Google guarantees a fresh refresh
 *  token AND the chance to grant the new calendar scope.
 */
export function buildAuthUrl(opts: {
  origin: string;
  state: string;
  scopes?: string[];
  loginHint?: string;
  forceConsent?: boolean;
  includeGrantedScopes?: boolean;
}): string {
  const client = getClient(`${opts.origin}${REDIRECT_PATH}`);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: opts.scopes ?? LOGIN_SCOPES,
    state: opts.state,
    prompt: opts.forceConsent ? "consent" : "select_account",
    login_hint: opts.loginHint,
    include_granted_scopes: opts.includeGrantedScopes ?? true,
  });
}

/** Exchange the code returned by Google for tokens + profile.
 *  Returns the verified Google identity (sub, email, etc), along with the
 *  refresh token and the granted scopes (so callers can persist them to
 *  the `GoogleConnection` table). */
export async function exchangeCode(opts: {
  code: string;
  origin: string;
}): Promise<{
  profile: GoogleProfile;
  refreshToken?: string;
  accessToken?: string;
  scopes: string[];
  expiresAt?: Date;
}> {
  const client = getClient(`${opts.origin}${REDIRECT_PATH}`);
  const { tokens } = await client.getToken(opts.code);
  client.setCredentials(tokens);

  if (!tokens.id_token) throw new Error("No id_token returned from Google");
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_OAUTH_CLIENT_ID!,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload?.email) throw new Error("Incomplete Google profile");

  const scopes = typeof tokens.scope === "string" ? tokens.scope.split(/\s+/).filter(Boolean) : [];
  const expiresAt = typeof tokens.expiry_date === "number" ? new Date(tokens.expiry_date) : undefined;

  return {
    profile: {
      sub: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name ?? payload.email.split("@")[0],
      picture: payload.picture,
    },
    refreshToken: tokens.refresh_token ?? undefined,
    accessToken: tokens.access_token ?? undefined,
    scopes,
    expiresAt,
  };
}
