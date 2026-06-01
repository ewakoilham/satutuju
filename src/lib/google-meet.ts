/** Per-user Google Calendar + Meet helper — Phase D.3 of the v5 redesign.
 *
 *  Differs from src/lib/google-calendar.ts (which uses a single platform
 *  service-account refresh token via `GOOGLE_REFRESH_TOKEN`): this module
 *  loads the *mentor's own* refresh token from the `GoogleConnection` table,
 *  exchanges it for a short-lived access token, and creates the Meet event
 *  on their personal Calendar. The mentee gets added as an attendee.
 *
 *  This is the path the v5 design assumes — mentors run their own sessions
 *  on their own calendars, and Satu Tuju coordinates rather than owns.
 */

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "@/lib/supabase";

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const TZ = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";

export class NotConnected extends Error {
  constructor() {
    super("Mentor belum menghubungkan Google Calendar.");
    this.name = "NotConnected";
  }
}

export class MissingCalendarScope extends Error {
  constructor() {
    super("Akses Calendar belum diberikan. Mentor perlu menghubungkan ulang Google Calendar.");
    this.name = "MissingCalendarScope";
  }
}

export interface GoogleConnectionRow {
  userId: string;
  googleSub: string;
  refreshToken: string;
  scopes: string;
}

export async function getConnection(userId: string): Promise<GoogleConnectionRow | null> {
  const { data } = await supabase
    .from("GoogleConnection")
    .select("userId, googleSub, refreshToken, scopes")
    .eq("userId", userId)
    .maybeSingle();
  return (data as GoogleConnectionRow | null) ?? null;
}

export function hasCalendarScope(scopes: string): boolean {
  return scopes.split(/\s+/).includes("https://www.googleapis.com/auth/calendar.events");
}

/** Upsert a row in GoogleConnection. Called by the OAuth callback whenever
 *  the user grants any Google scope to us. */
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
    // Union the previously-granted scopes with the new ones so we don't lose
    // a previously-granted scope when the user re-consents for a narrower set.
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

/** Build an authenticated calendar client for the given user. Throws
 *  NotConnected if they've never granted us anything, MissingCalendarScope
 *  if they granted login scopes but not calendar.events. */
async function getCalendarClient(userId: string) {
  const conn = await getConnection(userId);
  if (!conn) throw new NotConnected();
  if (!hasCalendarScope(conn.scopes)) throw new MissingCalendarScope();

  const oauth = new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  oauth.setCredentials({ refresh_token: conn.refreshToken });
  return google.calendar({ version: "v3", auth: oauth });
}

export interface CreateMeetParams {
  mentorUserId: string;
  title: string;
  description?: string;
  /** Start time. We let Calendar interpret in `TZ`. */
  startsAt: Date;
  /** End time. Defaults to startsAt + 60min if not provided. */
  endsAt?: Date;
  attendeeEmails: string[];
}

/** Create a Google Calendar event with a Meet link attached. Returns the
 *  event id + meet URL on success. */
export async function createMeetEvent(p: CreateMeetParams): Promise<{ eventId: string; meetLink: string }> {
  const calendar = await getCalendarClient(p.mentorUserId);
  const end = p.endsAt ?? new Date(p.startsAt.getTime() + 60 * 60_000);

  // Format as a wall-clock string in the chosen tz so Calendar interprets it
  // correctly regardless of where the server is.
  const toWallClock = (d: Date) => {
    // Use ISO-ish "YYYY-MM-DDTHH:mm:ss" — calendar API requires no Z when
    // a `timeZone` is also passed.
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  };

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: p.title,
      description: p.description,
      start: { dateTime: toWallClock(p.startsAt), timeZone: "UTC" },
      end: { dateTime: toWallClock(end), timeZone: "UTC" },
      attendees: p.attendeeEmails.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: globalThis.crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
      },
    },
  });

  const meetLink =
    event.data.hangoutLink ||
    event.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ||
    "";

  if (!event.data.id || !meetLink) {
    throw new Error("Calendar membuat event tapi Meet link tidak terlampir. Coba lagi.");
  }
  return { eventId: event.data.id, meetLink };
}

export { CALENDAR_SCOPES, TZ };
