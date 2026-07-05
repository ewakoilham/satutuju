import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { fetchFirefliesTranscript, meetCode } from "@/lib/integrations/fireflies";

export const runtime = "nodejs";

/**
 * Fireflies.ai webhook receiver. Fires when a meeting finishes transcribing.
 * We pull the recap (summary + action items + transcript URL) and attach it to
 * the matching mentoring Session.
 *
 * Configure in Fireflies → Settings → Developer Settings → Webhooks:
 *   URL: ${APP_URL}/api/webhooks/fireflies
 *   Secret: the same value as FIREFLIES_WEBHOOK_SECRET
 *
 * Authentication: Fireflies signs each request with an HMAC-SHA256 of the raw
 * body, sent in the `x-hub-signature` header as `sha256=<hex>` (V2 uses that
 * header name without the -256 suffix). We recompute and timing-safe compare.
 *
 * Payload shape:
 *   { "meetingId": "<transcript id>", "eventType": "Transcription completed" }
 *
 * Matching: the transcript's meeting_link (Google Meet URL) is matched against
 * ScheduleBooking.googleMeetLink (by stable Meet code) → sessionId → Session.
 * Unmatched events are acknowledged (200) so Fireflies doesn't retry forever.
 */

function signatureValid(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Accept "sha256=<hex>" or a bare "<hex>".
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  // Raw body is required for HMAC — any re-serialization would break the digest.
  const raw = await req.text();
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  const sig = req.headers.get("x-hub-signature") || req.headers.get("x-hub-signature-256");

  // Signature verification is OPTIONAL: Fireflies only signs requests when the
  // (optional) signing secret is configured in its dashboard. We enforce it
  // only when BOTH a secret env var and a signature header are present — so it
  // works out of the box with the signing secret left blank, and hardens
  // automatically once you set the same secret on both sides.
  if (secret && sig) {
    if (!signatureValid(raw, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[fireflies] webhook accepted WITHOUT signature verification — set FIREFLIES_WEBHOOK_SECRET (env) AND a matching signing secret in Fireflies to enforce.",
    );
  }

  let body: { meetingId?: string; eventType?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Could not parse body" }, { status: 400 });
  }

  const { meetingId, eventType } = body;

  // Act only on "recap ready" events. Fireflies naming varies by webhook
  // version: classic "Transcription completed" and V2 "Meeting Transcribed" /
  // "Meeting Summarized". Ignore not-ready events like "Meeting Bot Joined".
  const ev = (eventType ?? "").toLowerCase();
  const notReady = /bot ?joined|started|processing|scheduled|failed/.test(ev);
  const ready = /transcri|summar|complete/.test(ev);
  if (notReady || !ready) {
    return NextResponse.json({ ok: true, note: `ignored event: ${eventType ?? "unknown"}` });
  }
  if (!meetingId) {
    return NextResponse.json({ ok: true, note: "no meetingId" });
  }

  // Pull the transcript recap from Fireflies.
  const t = await fetchFirefliesTranscript(meetingId);
  if (!t) {
    return NextResponse.json({ ok: true, note: "transcript fetch failed" });
  }

  // Match the meeting link back to the mentoring session.
  const code = meetCode(t.meetingLink);
  if (!code) {
    return NextResponse.json({ ok: true, note: "no meeting link on transcript" });
  }

  const { data: bookings, error: bookErr } = await supabase
    .from("ScheduleBooking")
    .select("id, sessionId, googleMeetLink")
    .ilike("googleMeetLink", `%${code}%`);
  if (bookErr) {
    console.error("[fireflies] booking lookup error:", bookErr);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  const booking = (bookings ?? []).find((b) => meetCode(b.googleMeetLink) === code);
  if (!booking?.sessionId) {
    return NextResponse.json({ ok: true, note: "no matching session for meeting link" });
  }

  const { error: updErr } = await supabase
    .from("Session")
    .update({
      firefliesTranscriptId: t.id,
      firefliesOverview: t.overview,
      firefliesShortSummary: t.shortSummary,
      firefliesActionItems: t.actionItems,
      firefliesTranscriptUrl: t.transcriptUrl,
      firefliesRecapAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", booking.sessionId);
  if (updErr) {
    console.error("[fireflies] session recap update error:", updErr);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionId: booking.sessionId });
}
