/** Recurring-availability → ScheduleSlot materializer.
 *
 *  This is the "cascade job" the AvailabilityRule schema comment promised but
 *  that was never built. A mentor defines weekly rules ("free every Tuesday
 *  16:00–17:00"); this module turns them into concrete ScheduleSlot rows for
 *  the next 8 weeks so mentees have something bookable.
 *
 *  Properties:
 *    - Idempotent. Running it repeatedly converges to the same set of slots
 *      (keyed on mentor + date + startTime). Safe to call on every rule edit
 *      AND from a daily cron that rolls the 8-week window forward.
 *    - Non-destructive. It only ever creates `source="rule"` slots, and only
 *      removes rule-slots that are still `available` (never booked/pending) and
 *      no longer produced by any active rule. Manually-created slots and any
 *      slot with a booking are left completely alone.
 *    - Timezone-correct. "The next 8 weeks of Tuesdays" is computed in the
 *      platform timezone (Asia/Jakarta by default), not UTC, so a rule never
 *      lands on the wrong calendar day near midnight.
 *
 *  Requires the `source` (text, default 'manual') and `ruleId` (text, null)
 *  columns on ScheduleSlot — see the accompanying migration.
 */

import { supabase } from "@/lib/supabase";

const TZ = process.env.CALENDAR_TIMEZONE || "Asia/Jakarta";
export const WEEKS_AHEAD = 8;

export interface AvailabilityRuleRow {
  id: string;
  mentorId: string;
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  recurMode: string; // "unlimited" | "fixed"
  weeksAhead: number | null;
  active: boolean;
}

interface ExistingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  ruleId: string | null;
}

interface InsertSlot {
  id: string;
  mentorId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: string;
  source: string;
  ruleId: string;
  createdAt: string;
  updatedAt: string;
}

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMins(aStart) < toMins(bEnd) && toMins(aEnd) > toMins(bStart);

/** Format a Date as "YYYY-MM-DD" in the platform timezone. */
function ymdInTz(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Every calendar date from today (in TZ) through WEEKS_AHEAD weeks, each
 *  tagged with its weekday (0=Sun..6=Sat) and a 0-based day index. We anchor
 *  on UTC-noon of the local "today" so day-stepping never drifts across a date
 *  boundary. */
function horizonDates(): { date: string; dow: number; dayIndex: number }[] {
  const [y, m, d] = ymdInTz(new Date()).split("-").map(Number);
  const anchor = Date.UTC(y, m - 1, d, 12, 0, 0);
  const out: { date: string; dow: number; dayIndex: number }[] = [];
  for (let i = 0; i < WEEKS_AHEAD * 7; i++) {
    const dt = new Date(anchor + i * 86_400_000);
    out.push({ date: dt.toISOString().slice(0, 10), dow: dt.getUTCDay(), dayIndex: i });
  }
  return out;
}

/** Materialize one mentor's active rules into ScheduleSlot rows. Returns how
 *  many slots were created / removed so callers can surface a summary. */
export async function materializeAvailability(
  mentorId: string,
): Promise<{ created: number; updated: number; removed: number }> {
  const { data: rulesRaw } = await supabase
    .from("AvailabilityRule")
    .select("id, mentorId, dayOfWeek, startTime, endTime, recurMode, weeksAhead, active")
    .eq("mentorId", mentorId)
    .eq("active", true);
  const activeRules = (rulesRaw || []) as AvailabilityRuleRow[];

  const dates = horizonDates();
  const today = dates[0]?.date ?? ymdInTz(new Date());

  // Desired rule-slots, keyed `${date}|${startTime}`. First rule to claim a
  // start time on a date wins (overlapping rules don't double-book a slot).
  const desired = new Map<string, { date: string; startTime: string; endTime: string; ruleId: string }>();
  for (const rule of activeRules) {
    const maxIndex =
      rule.recurMode === "fixed" && rule.weeksAhead != null ? rule.weeksAhead * 7 : Infinity;
    for (const c of dates) {
      if (c.dow !== rule.dayOfWeek) continue;
      if (c.dayIndex >= maxIndex) continue;
      const key = `${c.date}|${rule.startTime}`;
      if (!desired.has(key)) {
        desired.set(key, { date: c.date, startTime: rule.startTime, endTime: rule.endTime, ruleId: rule.id });
      }
    }
  }

  // Existing future slots for this mentor.
  const { data: existingRaw } = await supabase
    .from("ScheduleSlot")
    .select("id, date, startTime, endTime, status, source, ruleId")
    .eq("mentorId", mentorId)
    .gte("date", today);
  const existing = (existingRaw || []) as ExistingSlot[];

  const byDate = new Map<string, ExistingSlot[]>();
  const ruleSlotByKey = new Map<string, ExistingSlot>();
  for (const s of existing) {
    const arr = byDate.get(s.date) || [];
    arr.push(s);
    byDate.set(s.date, arr);
    if (s.source === "rule") ruleSlotByKey.set(`${s.date}|${s.startTime}`, s);
  }

  const nowIso = new Date().toISOString();
  const toInsert: InsertSlot[] = [];
  let updated = 0;

  for (const [key, want] of desired) {
    const existingRuleSlot = ruleSlotByKey.get(key);

    // Already have a rule-slot at this exact date+start.
    if (existingRuleSlot) {
      // Keep its window in sync if the rule's end time changed and nobody has
      // booked it yet. Booked/pending slots are frozen.
      if (existingRuleSlot.status === "available" && existingRuleSlot.endTime !== want.endTime) {
        await supabase
          .from("ScheduleSlot")
          .update({ endTime: want.endTime, updatedAt: nowIso })
          .eq("id", existingRuleSlot.id);
        updated++;
      }
      continue;
    }

    // Don't create over a manual slot or any other slot that overlaps the
    // window on that day.
    const sameDay = byDate.get(want.date) || [];
    if (sameDay.some((s) => overlaps(want.startTime, want.endTime, s.startTime, s.endTime))) continue;

    toInsert.push({
      id: globalThis.crypto.randomUUID(),
      mentorId,
      date: want.date,
      startTime: want.startTime,
      endTime: want.endTime,
      notes: null,
      status: "available",
      source: "rule",
      ruleId: want.ruleId,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  if (toInsert.length) await supabase.from("ScheduleSlot").insert(toInsert);

  // Remove orphaned rule-slots: still available, future-dated, no longer
  // produced by any active rule. Double-check there's no booking attached
  // before deleting (defensive — status should already reflect this).
  const orphanIds = existing
    .filter((s) => s.source === "rule" && s.status === "available")
    .filter((s) => !desired.has(`${s.date}|${s.startTime}`))
    .map((s) => s.id);

  let removed = 0;
  if (orphanIds.length) {
    const { data: booked } = await supabase
      .from("ScheduleBooking")
      .select("slotId")
      .in("slotId", orphanIds);
    const bookedSet = new Set((booked || []).map((b: { slotId: string }) => b.slotId));
    const deletable = orphanIds.filter((id) => !bookedSet.has(id));
    if (deletable.length) {
      await supabase.from("ScheduleSlot").delete().in("id", deletable);
      removed = deletable.length;
    }
  }

  return { created: toInsert.length, updated, removed };
}

/** Materialize every mentor that has at least one active rule. Used by the
 *  daily cron to roll the 8-week window forward. */
export async function materializeAllMentors(): Promise<{
  mentors: number;
  created: number;
  updated: number;
  removed: number;
}> {
  const { data: rules } = await supabase
    .from("AvailabilityRule")
    .select("mentorId")
    .eq("active", true);
  const mentorIds = [...new Set((rules || []).map((r: { mentorId: string }) => r.mentorId))];

  let created = 0;
  let updated = 0;
  let removed = 0;
  for (const id of mentorIds) {
    const r = await materializeAvailability(id);
    created += r.created;
    updated += r.updated;
    removed += r.removed;
  }
  return { mentors: mentorIds.length, created, updated, removed };
}
