import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const calId = process.env.GOOGLE_CALENDAR_ID || "primary";

  if (!email || !key) {
    return NextResponse.json({
      error: "Missing env vars",
      hasEmail: !!email,
      hasKey: !!key,
      emailValue: email || "MISSING",
    });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    // Test: create a real event
    const event = await calendar.events.insert({
      calendarId: calId,
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
      calendarId: calId,
      serviceAccount: email,
    });
  } catch (err: unknown) {
    const gErr = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
      code?: string;
    };
    return NextResponse.json({
      error: "Google API failed",
      status: gErr.response?.status,
      message: gErr.message,
      code: gErr.code,
      data: gErr.response?.data,
      serviceAccount: email,
      calendarId: calId,
    });
  }
}
