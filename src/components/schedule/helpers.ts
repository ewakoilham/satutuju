import { HOUR_START, HOUR_H, HOUR_END, MENTOR_PALETTE } from "./constants";
import type { Slot } from "./types";

// ── Date helpers ──────────────────────────────────────────────────────────

export function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function fmtHour(h: number): string {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function fmtDate(s: string): string {
  const [y, m, d] = s.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function fmtDateLong(s: string): string {
  const [y, m, d] = s.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ── Time helpers ──────────────────────────────────────────────────────────

export function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minsToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** All 90-min windows within a time range at 30-min steps */
export function getTimeFrameOptions(
  startTime: string,
  endTime: string
): Array<{ startTime: string; endTime: string }> {
  const start = toMins(startTime);
  const end   = toMins(endTime);
  if (end - start <= 90) {
    return [{ startTime, endTime: minsToTime(Math.min(start + 90, end)) }];
  }
  const opts: Array<{ startTime: string; endTime: string }> = [];
  for (let s = start; s + 90 <= end; s += 30) {
    opts.push({ startTime: minsToTime(s), endTime: minsToTime(s + 90) });
  }
  return opts;
}

// ── Position helpers ──────────────────────────────────────────────────────

/** Convert start/end time to absolute px position + height within the grid */
export function slotPos(startTime: string, endTime: string): { top: number; height: number } {
  const top    = ((toMins(startTime) - HOUR_START * 60) / 60) * HOUR_H;
  const height = Math.max(((toMins(endTime) - toMins(startTime)) / 60) * HOUR_H - 2, 22);
  return { top, height };
}

/** Position a fixed popover near the click without overflowing the viewport */
export function calcPopoverPos(x: number, y: number, w = 280, maxH = 380) {
  const left = x + w > window.innerWidth - 16 ? x - w - 8 : x + 8;
  const top  = Math.max(8, Math.min(y - 20, window.innerHeight - maxH));
  return { left, top };
}

// ── Slot color ────────────────────────────────────────────────────────────

/**
 * One slot = one color. No segment splitting.
 *
 * Mentor/admin:
 *   - Has accepted booking  → emerald
 *   - Has pending bookings  → amber
 *   - Available              → blue
 *
 * Mentee:
 *   - myBooking accepted     → emerald
 *   - myBooking pending      → amber
 *   - Available (no booking) → blue
 *   - Booked by others       → gray
 */
export function slotColorClass(slot: Slot, role: string): string {
  if (role === "mentee") {
    const bs = slot.myBooking?.status;
    if (bs === "accepted") return "bg-emerald-500 hover:bg-emerald-600";
    if (bs === "pending")  return "bg-amber-400 hover:bg-amber-500";
    if (bs === "rejected") return "bg-red-400 hover:bg-red-500";
    // No booking by this mentee — check slot availability
    const hasAccepted = slot.bookings?.some(b => b.status === "accepted");
    if (hasAccepted) return "bg-text-muted-2 hover:bg-text-muted";
    return "bg-blue-600 hover:bg-blue-700";
  }
  // Mentor or fallback
  const hasAccepted = slot.bookings?.some(b => b.status === "accepted");
  if (hasAccepted) return "bg-emerald-500 hover:bg-emerald-600";
  const hasPending = slot.bookings?.some(b => b.status === "pending");
  if (hasPending) return "bg-amber-400 hover:bg-amber-500";
  return "bg-blue-600 hover:bg-blue-700";
}

/** Text color: dark on amber, white on everything else */
export function slotTextClass(slot: Slot, role: string): string {
  if (role === "mentee" && slot.myBooking?.status === "pending") return "text-foreground";
  if (role !== "mentee") {
    const hasPending = slot.bookings?.some(b => b.status === "pending");
    const hasAccepted = slot.bookings?.some(b => b.status === "accepted");
    if (hasPending && !hasAccepted) return "text-foreground";
  }
  return "text-white";
}

// ── Overlap layout (sweep-line) ───────────────────────────────────────────

export interface SlotLayout {
  slot: Slot;
  col: number;
  totalCols: number;
}

/** Assign sub-columns for overlapping slots (Google Calendar style) */
export function computeDayLayout(daySlots: Slot[]): SlotLayout[] {
  if (daySlots.length === 0) return [];
  const sorted = [...daySlots].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
  const colEnds: number[] = [];
  const colNums: number[] = [];

  for (const slot of sorted) {
    const start = toMins(slot.startTime);
    const end   = toMins(slot.endTime);
    let col = colEnds.findIndex(e => e <= start);
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else colEnds[col] = end;
    colNums.push(col);
  }

  const totalCols = colEnds.length;
  return sorted.map((slot, i) => ({ slot, col: colNums[i], totalCols }));
}

// ── Mentor color map (admin view) ─────────────────────────────────────────

export function buildMentorColorMap(slots: Slot[]): Map<string, string> {
  const ids = [...new Set(slots.map(s => s.mentorId).filter(Boolean) as string[])].sort();
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, MENTOR_PALETTE[i % MENTOR_PALETTE.length]));
  return map;
}

// ── Overlap / free-gap helpers (mentor scheduling) ────────────────────────

interface Interval { start: number; end: number; }

/** Build sorted busy intervals from a list of slots, optionally excluding one (for edit). */
export function buildBusy(slots: Slot[], excludeId?: string): Interval[] {
  return slots
    .filter(s => s.id !== excludeId)
    .map(s => ({ start: toMins(s.startTime), end: toMins(s.endTime) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Given a desired start time (in minutes), push it past any overlapping busy
 * interval, then return [clampedStart, clampedEnd] where end = start + 60
 * capped at the next busy interval.
 * Returns null if there is no 60-min free gap starting at or after rawStart.
 */
export function clampToFreeGap(
  rawStart: number,
  busy: Interval[],
  minDur = 60,
  maxDur = 90,
): { start: number; end: number } | null {
  // Push start past any slot it falls inside (handle consecutive slots)
  let start = rawStart;
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of busy) {
      if (start >= b.start && start < b.end) {
        start = b.end;
        changed = true;
      }
    }
  }

  // Hard ceiling
  if (start >= HOUR_END * 60) return null;

  // Find the next busy interval after start
  const next = busy.find(b => b.start > start);
  const gapEnd = next ? next.start : HOUR_END * 60;

  // How much free space do we have?
  if (gapEnd - start < minDur) return null;

  const end = Math.min(start + Math.min(maxDur, gapEnd - start), gapEnd);
  return { start, end };
}

/**
 * Clamp an end time so it does not overlap the next busy interval after
 * startMins. Returns a (possibly adjusted) end in minutes.
 * Also enforces minDur / maxDur from the start.
 */
export function clampEndToGap(
  startMins: number,
  rawEnd: number,
  busy: Interval[],
  minDur = 60,
  maxDur = 90,
): number {
  const next = busy.find(b => b.start > startMins);
  const gapEnd = next ? next.start : HOUR_END * 60;
  // Apply duration limits, then don't cross next slot
  const clamped = Math.min(rawEnd, gapEnd, startMins + maxDur);
  return Math.max(clamped, startMins + minDur); // ensure at least minDur (may still violate gapEnd)
}
