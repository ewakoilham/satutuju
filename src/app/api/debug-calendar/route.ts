import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadAuth, makeAuthedClient } from "@/lib/integrations/google-calendar";

/**
 * Diagnostic endpoint for the Google Calendar integration. Admin only.
 *
 * Runs a 2-step health check using the singleton refresh token stored
 * via the OAuth dance at /api/auth/google:
 *
 *   1. Token exchange — confirms the refresh token still works
 *      (i.e. the admin hasn't revoked access at
 *      https://myaccount.google.com/permissions).
 *   2. Event creation — confirms the scope grants write access + the
 *      account can mint a Meet link (some Workspace tiers restrict
 *      conferenceData.createRequest).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const auth = await loadAuth();
  if (!auth) {
    return NextResponse.json({
      error: "Not connected. Visit /api/auth/google to authorize.",
      connected: false,
    }, { status: 412 });
  }

  const calendar = makeAuthedClient(auth.refreshToken);

  // Step 2: try creating a test event with Meet link
  try {
    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: "Test Event — Delete Me",
        start: { dateTime: "2026-04-08T10:00:00", timeZone: "Asia/Jakarta" },
        end: { dateTime: "2026-04-08T11:00:00", timeZone: "Asia/Jakarta" },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      googleEmail: auth.googleEmail,
      eventId: event.data.id,
      meetLink: event.data.hangoutLink || "NO_MEET_LINK",
    });
  } catch (err: unknown) {
    const gErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    return NextResponse.json({
      error: "Event creation failed",
      status: gErr.response?.status,
      message: gErr.message,
      data: gErr.response?.data,
    });
  }
}
