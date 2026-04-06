import { google } from "googleapis";

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: "v3", auth });
const tz = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";

export async function createCalendarEvent(params: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  description?: string;
}): Promise<{ eventId: string; meetLink: string } | null> {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return null;

  try {
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

    return {
      eventId: event.data.id!,
      meetLink: event.data.hangoutLink!,
    };
  } catch (err) {
    console.error("Google Calendar create error:", err);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!process.env.GOOGLE_REFRESH_TOKEN) return;

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });
  } catch (err) {
    console.error("Google Calendar delete error:", err);
  }
}
