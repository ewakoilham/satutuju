import "server-only";

/**
 * Thin client for the Fireflies.ai GraphQL API.
 *
 * Docs: https://docs.fireflies.ai/graphql-api/query/transcript
 * Auth: Bearer token (FIREFLIES_API_KEY in env; Fireflies dashboard →
 *       Settings → Developer Settings → API Key).
 *
 * Used server-side by the Fireflies webhook (/api/webhooks/fireflies) to pull
 * a completed meeting's recap (summary + action items + transcript link) and
 * attach it to the matching mentoring Session.
 */

const FIREFLIES_GRAPHQL = "https://api.fireflies.ai/graphql";

/** Subset of the Transcript type we need for the session recap. */
export interface FirefliesTranscript {
  id: string;
  title: string | null;
  /** The web-conf URL (Google Meet). Matched against ScheduleBooking.googleMeetLink. */
  meetingLink: string | null;
  transcriptUrl: string | null;
  attendeeEmails: string[];
  /** Full narrative summary — mentor/admin-facing. */
  overview: string | null;
  /** Clean one-liner/paragraph — safe to show the mentee. */
  shortSummary: string | null;
  /** Action items (Fireflies returns a formatted string). */
  actionItems: string | null;
}

const TRANSCRIPT_QUERY = `
  query Transcript($id: String!) {
    transcript(id: $id) {
      id
      title
      meeting_link
      transcript_url
      meeting_attendees { email }
      summary {
        overview
        short_summary
        action_items
      }
    }
  }
`;

type RawTranscript = {
  id: string;
  title: string | null;
  meeting_link: string | null;
  transcript_url: string | null;
  meeting_attendees: Array<{ email: string | null }> | null;
  summary: {
    overview: string | null;
    short_summary: string | null;
    action_items: string | null;
  } | null;
};

/**
 * Fetch a single transcript by its Fireflies id (the `meetingId` delivered in
 * the webhook). Returns null on any error / missing key so the webhook can
 * fail soft. Never throws.
 */
export async function fetchFirefliesTranscript(
  transcriptId: string,
): Promise<FirefliesTranscript | null> {
  const apiKey = process.env.FIREFLIES_API_KEY;
  if (!apiKey) {
    console.error("[fireflies] FIREFLIES_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch(FIREFLIES_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: TRANSCRIPT_QUERY,
        variables: { id: transcriptId },
      }),
    });

    if (!res.ok) {
      console.error(`[fireflies] transcript fetch HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as {
      data?: { transcript?: RawTranscript | null };
      errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) {
      console.error("[fireflies] GraphQL errors:", json.errors.map((e) => e.message).join("; "));
      return null;
    }
    const t = json.data?.transcript;
    if (!t) return null;

    return {
      id: t.id,
      title: t.title ?? null,
      meetingLink: t.meeting_link ?? null,
      transcriptUrl: t.transcript_url ?? null,
      attendeeEmails: (t.meeting_attendees ?? [])
        .map((a) => a.email?.trim().toLowerCase())
        .filter((e): e is string => !!e),
      overview: t.summary?.overview ?? null,
      shortSummary: t.summary?.short_summary ?? null,
      actionItems: t.summary?.action_items ?? null,
    };
  } catch (err) {
    console.error("[fireflies] transcript fetch failed:", err);
    return null;
  }
}

/**
 * Extract the stable Google Meet code (e.g. "abc-defg-hij") from a Meet URL so
 * we can match a Fireflies meeting_link against a stored googleMeetLink even
 * if query params / trailing slashes differ. Returns the lowercased code, or
 * the normalized URL when it isn't a Meet link.
 */
export function meetCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
  if (m) return m[1].toLowerCase();
  return url.trim().replace(/\/+$/, "").toLowerCase();
}
