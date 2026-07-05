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
  const secret = process.env.FIREFLIES_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[fireflies] FIREFLIES_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Raw body is required for HMAC — any re-serialization would break the digest.
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature") || req.headers.get("x-hub-signature-256");
  if (!signatureValid(raw, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { meetingId?: string; eventType?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Could not parse body" }, { status: 400 });
  }

  const { meetingId, eventType } = body;
  if (eventType !== "Transcription completed") {
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
