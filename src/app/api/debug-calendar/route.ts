import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({
      error: "Missing env vars",
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
    });
  }

  // Step 1: test that the refresh token can get an access token
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  try {
    const { token } = await auth.getAccessToken();
    if (!token) {
      return NextResponse.json({ error: "getAccessToken returned null", tokenPreview: refreshToken.slice(0, 20) });
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    return NextResponse.json({
      error: "Failed to get access token",
      message: e.message,
      data: e.response?.data,
      tokenLength: refreshToken.length,
      tokenPreview: `${refreshToken.slice(0, 20)}...${refreshToken.slice(-10)}`,
      clientIdPreview: clientId.slice(0, 15),
    });
  }

  // Step 2: try creating a test event with Meet link
  try {
    const calendar = google.calendar({ version: "v3", auth });
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
      eventId: event.data.id,
      meetLink: event.data.hangoutLink || "NO_MEET_LINK",
    });
  } catch (err: unknown) {
    const gErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    return NextResponse.json({
      error: "Event creation failed (but auth works!)",
      status: gErr.response?.status,
      message: gErr.message,
      data: gErr.response?.data,
    });
  }
}
