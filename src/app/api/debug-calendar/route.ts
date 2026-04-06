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

    const result = await calendar.events.list({
      calendarId: calId,
      maxResults: 1,
    });

    return NextResponse.json({
      success: true,
      calendarId: result.data.summary,
      eventCount: result.data.items?.length ?? 0,
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
