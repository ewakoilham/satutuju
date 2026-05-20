import { loadAuth, makeAuthedClient } from "@/lib/integrations/google-calendar";

const tz = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";

/** Load the shared GoogleCalendarAuth singleton (set via OAuth dance at
 *  /api/auth/google by an admin). Returns null when nobody has connected
 *  yet — schedule booking flow then silently skips Calendar event creation
 *  rather than throwing. */
async function getCalendar() {
  const auth = await loadAuth();
  if (!auth) return null;
  return makeAuthedClient(auth.refreshToken);
}

export async function createCalendarEvent(params: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  description?: string;
}): Promise<{ eventId: string; meetLink: string } | null> {
  const calendar = await getCalendar();
  if (!calendar) {
    console.error("Google Calendar: not connected. Visit /api/auth/google to authorize.");
    return null;
  }

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

    // hangoutLink is the classic field; newer Meet links appear in conferenceData.entryPoints
    const meetLink =
      event.data.hangoutLink ||
      event.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === "video"
      )?.uri ||
      "";

    console.log("Google Calendar event created:", {
      eventId: event.data.id,
      meetLink,
      conferenceStatus: (event.data.conferenceData as Record<string, unknown>)?.status,
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
  const calendar = await getCalendar();
  if (!calendar) return;

  try {
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
