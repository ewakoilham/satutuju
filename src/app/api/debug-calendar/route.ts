import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { google } from "googleapis";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;
  const clientIdPreview = process.env.GOOGLE_CLIENT_ID?.slice(0, 15) || "MISSING";
  const tokenPreview = process.env.GOOGLE_REFRESH_TOKEN
    ? `${process.env.GOOGLE_REFRESH_TOKEN.slice(0, 20)}...${process.env.GOOGLE_REFRESH_TOKEN.slice(-10)}`
    : "MISSING";
  const tokenLength = process.env.GOOGLE_REFRESH_TOKEN?.length || 0;

  if (!hasClientId || !hasClientSecret || !hasRefreshToken) {
    return NextResponse.json({
      error: "Missing env vars",
      hasClientId,
      hasClientSecret,
      hasRefreshToken,
      clientIdPreview,
      tokenPreview,
    });
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "https://developers.google.com/oauthplayground",
    );
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    const calendar = google.calendar({ version: "v3", auth });

    // Try listing 1 event — minimal test
    const result = await calendar.events.list({
      calendarId: "primary",
      maxResults: 1,
    });

    return NextResponse.json({
      success: true,
      calendarId: result.data.summary,
      eventCount: result.data.items?.length ?? 0,
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
      clientIdPreview,
      tokenPreview,
      tokenLength,
    });
  }
}
