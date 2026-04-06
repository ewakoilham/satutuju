import { google } from "googleapis";

const tz = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";
const CALENDAR_OWNER = process.env.GOOGLE_CALENDAR_ID || "primary";

function getCalendar() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
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
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    console.error("Google Calendar: service account credentials not set");
    return null;
  }

  try {
    const calendar = getCalendar();
    const event = await calendar.events.insert({
      calendarId: CALENDAR_OWNER,
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

    return {
      eventId: event.data.id!,
      meetLink: event.data.hangoutLink || "",
    };
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
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return;

  try {
    const calendar = getCalendar();
    await calendar.events.delete({
      calendarId: CALENDAR_OWNER,
      eventId,
      sendUpdates: "all",
    });
  } catch (err: unknown) {
    const gErr = err as { response?: { data?: unknown }; message?: string };
    console.error("Google Calendar delete error:", gErr.response?.data || gErr.message);
  }
}
