import { google } from "googleapis";

const tz = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";

function getCalendar() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth });
}

export async function createCalendarEvent(params: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  description?: string;
}): Promise<{ eventId: string; meetLink: string } | null> {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("Google Calendar: GOOGLE_REFRESH_TOKEN not set");
    return null;
  }

  try {
    const calendar = getCalendar();
    const event = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: params.title,
        description: params.description,
        start: { dateTime: `${params.date}T${params.startTime}:00`, timeZone: tz },
        end: { dateTime: `${params.date}T${params.endTime}:00`, timeZone: tz },
        attendees: params.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "email", minutes: 1440 }],
        },
      },
    });

    // hangoutLink is the classic field; newer Meet links appear in conferenceData.entryPoints
    const meetLink =
      event.data.hangoutLink ||
      event.data.conferenceData?.entryPoints?.find(
        (ep: { entryPointType?: string; uri?: string }) => ep.entryPointType === "video"
      )?.uri ||
      "";

    console.log("Google Calendar event created:", {
      eventId: event.data.id,
      meetLink,
      conferenceStatus: event.data.conferenceData?.status?.statusCode,
    });

    return { eventId: event.data.id!, meetLink };
  } catch (err: unknown) {
    const gErr = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error("Google Calendar create error:", JSON.stringify({
      status: gErr.response?.status,
      data: gErr.response?.data,
      message: gErr.message,
    }));
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return;

  try {
    const calendar = getCalendar();
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });
  } catch (err: unknown) {
    const gErr = err as { response?: { data?: unknown }; message?: string };
    console.error("Google Calendar delete error:", gErr.response?.data || gErr.message);
  }
}
