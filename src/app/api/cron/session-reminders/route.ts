import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendSessionReminderEmail } from "@/lib/email-templates";

/**
 * Daily H-1 session reminder. Configured in vercel.json (runs every morning
 * WIB). Finds accepted bookings whose slot date is TOMORROW in Asia/Jakarta
 * and emails both mentor and mentee. `reminderSentAt` marks a booking as
 * reminded so a retry or manual invocation never double-sends.
 *
 * Auth: same CRON_SECRET bearer check as the other crons.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[session-reminders] CRON_SECRET not set");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Tomorrow" as a YYYY-MM-DD string in WIB — slot dates are stored as
  // plain date strings, so compare apples to apples.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const { data: bookings, error } = await supabase
    .from("ScheduleBooking")
    .select(
      "id, menteeId, sessionId, requestedStart, requestedEnd, googleMeetLink, slot:ScheduleSlot!inner(mentorId, date, startTime, endTime)",
    )
    .eq("status", "accepted")
    .is("reminderSentAt", null)
    .eq("slot.date", tomorrow);

  if (error) {
    console.error("[session-reminders] query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const b of bookings || []) {
    // PostgREST types a to-one join as an array — normalize.
    const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
    if (!slot || slot.date !== tomorrow) continue;

    try {
      const [{ data: mentor }, { data: mentee }] = await Promise.all([
        supabase.from("User").select("name, email").eq("id", slot.mentorId).single(),
        supabase.from("User").select("name, email").eq("id", b.menteeId).single(),
      ]);

      let sessionLabel: string | null = null;
      if (b.sessionId) {
        const { data: session } = await supabase
          .from("Session").select("sessionNum, topic").eq("id", b.sessionId).single();
        if (session) sessionLabel = `Sesi ${session.sessionNum}: ${session.topic}`;
      }

      const time =
        b.requestedStart && b.requestedEnd
          ? `${b.requestedStart}–${b.requestedEnd}`
          : `${slot.startTime}–${slot.endTime}`;

      const recipients = [
        { user: mentor, counterpart: mentee?.name ?? "mentee kamu" },
        { user: mentee, counterpart: mentor?.name ?? "mentor kamu" },
      ];
      for (const r of recipients) {
        if (!r.user?.email) continue;
        await sendSessionReminderEmail({
          to: r.user.email,
          recipientName: r.user.name ?? "",
          counterpartName: r.counterpart,
          date: slot.date,
          time,
          sessionLabel,
          meetLink: b.googleMeetLink,
        });
      }

      await supabase
        .from("ScheduleBooking")
        .update({ reminderSentAt: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (e) {
      console.error(`[session-reminders] failed for booking ${b.id}:`, e);
      failures.push(b.id);
    }
  }

  console.log(`[session-reminders] date=${tomorrow} reminded ${sent} booking(s), ${failures.length} failure(s)`);
  return NextResponse.json({ date: tomorrow, reminded: sent, failures });
}
