"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/Modal";

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_START = 7;
const HOUR_END   = 22;
const HOUR_H     = 60; // px per hour
const TOTAL_H    = HOUR_END - HOUR_START;
const DAY_ABBR   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Distinct colors for each mentor (admin view)
const MENTOR_PALETTE = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f59e0b", // amber
  "#6366f1", // indigo
];

// ── Types ──────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  menteeId: string;
  message: string | null;
  sessionId?: string | null;
  requestedStart?: string | null;
  requestedEnd?: string | null;
  status: string;
  createdAt: string;
  mentee?: { name: string; email: string };
}
interface Slot {
  id: string;
  mentorId?: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: string;
  bookings?: Booking[];
  myBooking?: Booking | null;
  mentor?: { name: string; email: string };
}
interface Session {
  id: string;
  sessionNum: number;
  phase: string;
  topic: string;
  status: string;
  scheduledAt?: string | null;
}
interface MentorOption { id: string; name: string; email: string; }
interface CreatePanel {
  date: string; startTime: string; endTime: string;
  x: number; y: number;
}
interface MenteeGhost {
  date: string; startTime: string; endTime: string;
}

// ── Date helpers ───────────────────────────────────────────────────────────
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function fmtHour(h: number) {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function fmtDate(s: string) {
  const [y, m, d] = s.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function fmtDateLong(s: string) {
  const [y, m, d] = s.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", {
    weekday: "long", day: "numeric", month: "long",
  });
}
function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minsToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
// Returns all 90-min windows within a slot at 30-min increments
function getTimeFrameOptions(startTime: string, endTime: string): Array<{ startTime: string; endTime: string }> {
  const start = toMins(startTime);
  const end   = toMins(endTime);
  if (end - start <= 90) {
    // Slot fits in one 90-min window; cap end at 90 min from start
    return [{ startTime, endTime: minsToTime(Math.min(start + 90, end)) }];
  }
  const opts: Array<{ startTime: string; endTime: string }> = [];
  for (let s = start; s + 90 <= end; s += 30) {
    opts.push({ startTime: minsToTime(s), endTime: minsToTime(s + 90) });
  }
  return opts;
}
function slotPos(startTime: string, endTime: string) {
  const top    = ((toMins(startTime) - HOUR_START * 60) / 60) * HOUR_H;
  const height = Math.max(((toMins(endTime) - toMins(startTime)) / 60) * HOUR_H - 2, 22);
  return { top, height };
}
// Returns visual segments so only the booked window is colored, rest stays available-blue
function getVisualSegments(slot: Slot, role: string): Array<{ startTime: string; endTime: string; type: string }> {
  type Seg = { startTime: string; endTime: string; type: string };

  if (role === "mentee") {
    const b = slot.myBooking;
    if (b && b.requestedStart && b.requestedEnd && (b.status === "pending" || b.status === "accepted")) {
      const segs: Seg[] = [];
      if (b.requestedStart > slot.startTime)
        segs.push({ startTime: slot.startTime, endTime: b.requestedStart, type: "available" });
      segs.push({ startTime: b.requestedStart, endTime: b.requestedEnd, type: b.status });
      if (b.requestedEnd < slot.endTime)
        segs.push({ startTime: b.requestedEnd, endTime: slot.endTime, type: "available" });
      return segs;
    }
  }

  if (role === "mentor") {
    const active = (slot.bookings || [])
      .filter((b): b is Booking & { requestedStart: string; requestedEnd: string } =>
        (b.status === "pending" || b.status === "accepted") &&
        typeof b.requestedStart === "string" && typeof b.requestedEnd === "string"
      )
      .sort((a, b) => toMins(a.requestedStart) - toMins(b.requestedStart));
    if (active.length > 0) {
      const segs: Seg[] = [];
      let cur = slot.startTime;
      for (const b of active) {
        if (b.requestedStart > cur)
          segs.push({ startTime: cur, endTime: b.requestedStart, type: "available" });
        segs.push({ startTime: b.requestedStart, endTime: b.requestedEnd, type: b.status });
        cur = b.requestedEnd;
      }
      if (cur < slot.endTime)
        segs.push({ startTime: cur, endTime: slot.endTime, type: "available" });
      return segs;
    }
  }

  // Default: single block with overall slot status
  return [{ startTime: slot.startTime, endTime: slot.endTime, type: slot.status }];
}

function slotBg(slot: Slot, role: string) {
  if (role === "mentee") {
    const bs = slot.myBooking?.status;
    if (bs === "accepted") return "bg-emerald-500";
    if (bs === "pending")  return "bg-amber-400";
    if (slot.status === "available") return "bg-blue-600";
    return "bg-gray-400";
  }
  if (slot.status === "available") return "bg-blue-600";
  if (slot.status === "pending")   return "bg-amber-500";
  if (slot.status === "booked")    return "bg-emerald-500";
  return "bg-gray-400";
}

// ── Mentor color map (admin view) ─────────────────────────────────────────
function buildMentorColorMap(slots: Slot[]): Map<string, string> {
  // Stable sort by mentorId so colors don't jump on re-fetch
  const ids = [...new Set(slots.map(s => s.mentorId).filter(Boolean) as string[])].sort();
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, MENTOR_PALETTE[i % MENTOR_PALETTE.length]));
  return map;
}

// ── Column layout for overlapping slots ───────────────────────────────────
interface SlotLayout { slot: Slot; col: number; totalCols: number; }

function computeDayLayout(daySlots: Slot[]): SlotLayout[] {
  if (daySlots.length === 0) return [];
  const sorted = [...daySlots].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));
  const colEnds: number[] = [];   // latest end-time currently occupying each sub-column
  const colNums: number[] = [];

  for (const slot of sorted) {
    const start = toMins(slot.startTime);
    const end   = toMins(slot.endTime);
    let col = colEnds.findIndex(e => e <= start); // reuse any freed column
    if (col === -1) { col = colEnds.length; colEnds.push(end); }
    else colEnds[col] = end;
    colNums.push(col);
  }

  const totalCols = colEnds.length;
  return sorted.map((slot, i) => ({ slot, col: colNums[i], totalCols }));
}

// ── Popover position helper ────────────────────────────────────────────────
function calcPopoverPos(x: number, y: number, w = 280, maxH = 380) {
  const left = x + w > window.innerWidth - 16 ? x - w - 8 : x + 8;
  const top  = Math.max(8, Math.min(y - 20, window.innerHeight - maxH));
  return { left, top };
}

// ── Current time indicator ─────────────────────────────────────────────────
function NowLine() {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const offset = new Date().getHours() * 60 + new Date().getMinutes() - HOUR_START * 60;
      setTop(offset < 0 || offset > TOTAL_H * 60 ? null : (offset / 60) * HOUR_H);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);
  if (top === null) return null;
  return (
    <div className="absolute left-0 right-0 flex items-center pointer-events-none z-10" style={{ top }}>
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  );
}

// ── Inline create card (no backdrop — Google Calendar style) ───────────────
function InlineCreateCard({ panel, onSave, onClose, onUpdateTime }: {
  panel: CreatePanel;
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  onClose: () => void;
  onUpdateTime: (st: string, et: string) => void;
}) {
  const ref  = useRef<HTMLDivElement>(null);
  const [st, setSt]       = useState(panel.startTime);
  const [et, setEt]       = useState(panel.endTime);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  function changeSt(v: string) { setSt(v); onUpdateTime(v, et); }
  function changeEt(v: string) { setEt(v); onUpdateTime(st, v); }

  async function save() {
    if (!st || !et) { setErr("Start and end time required."); return; }
    if (st >= et)   { setErr("Start must be before end."); return; }
    setSaving(true);
    try { await onSave({ date: panel.date, startTime: st, endTime: et, notes }); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  const { left, top } = calcPopoverPos(panel.x, panel.y, 280, 260);

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
      style={{ left, top, width: 280 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-blue-600" />
          <span className="text-xs font-semibold text-gray-600">New Slot</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Date */}
        <p className="text-sm font-semibold text-gray-800 leading-tight">{fmtDateLong(panel.date)}</p>

        {/* Time row */}
        <div className="flex items-center gap-2">
          <input
            type="time" value={st}
            onChange={e => changeSt(e.target.value)}
            className="input-field text-sm py-1.5 flex-1 min-w-0"
          />
          <span className="text-gray-400 text-sm flex-shrink-0">–</span>
          <input
            type="time" value={et}
            onChange={e => changeEt(e.target.value)}
            className="input-field text-sm py-1.5 flex-1 min-w-0"
          />
        </div>

        {/* Notes */}
        <input
          type="text" value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes (optional)"
          className="input-field w-full text-sm"
          onKeyDown={e => { if (e.key === "Enter") save(); }}
        />

        {err && <p className="text-xs text-red-500">{err}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-1.5">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-sm py-1.5">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit slot modal (center, used only for editing existing slots) ──────────
function EditSlotModal({ open, onClose, onSave, initial }: {
  open: boolean;
  onClose: () => void;
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  initial?: { id?: string; date?: string; startTime?: string; endTime?: string; notes?: string | null };
}) {
  const [date, setDate]   = useState("");
  const [st, setSt]       = useState("");
  const [et, setEt]       = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  useEffect(() => {
    if (open) {
      setDate(initial?.date || "");
      setSt(initial?.startTime || "");
      setEt(initial?.endTime || "");
      setNotes(initial?.notes || "");
      setErr("");
    }
  }, [open, initial]);

  async function save() {
    if (!date || !st || !et) { setErr("Date, start and end time required."); return; }
    if (st >= et)             { setErr("Start must be before end."); return; }
    setSaving(true);
    try { await onSave({ date, startTime: st, endTime: et, notes }); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-[family-name:var(--font-heading)]">Edit Slot</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400">
            <Icon name="x" size={16} />
          </button>
        </div>
        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Start</label>
              <input type="time" value={st} onChange={e => setSt(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">End</label>
              <input type="time" value={et} onChange={e => setEt(e.target.value)} className="input-field w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Notes <span className="text-gray-300">(optional)</span>
            </label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. via Google Meet" className="input-field w-full" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-sm py-2">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking modal (mentee) — session required, time-frame picker, optional message ──
function BookingModal({ open, slot, sessions, initialWindow, onClose, onBook, onPreviewChange }: {
  open: boolean;
  slot: Slot | null;
  sessions: Session[];
  initialWindow?: { startTime: string; endTime: string };
  onClose: () => void;
  onBook: (slotId: string, opts: { sessionId: string; requestedStart: string; requestedEnd: string; message: string }) => Promise<void>;
  onPreviewChange: (startTime: string, endTime: string) => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [timeFrame, setTimeFrame] = useState("");
  const [msg, setMsg]             = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const timeFrameOptions = useMemo(
    () => slot ? getTimeFrameOptions(slot.startTime, slot.endTime) : [],
    [slot]
  );

  // Reset form whenever the modal opens for a new slot
  useEffect(() => {
    if (open && slot) {
      setSessionId("");
      setMsg("");
      setErr("");
      const opts = getTimeFrameOptions(slot.startTime, slot.endTime);
      // Pre-select whichever option matches the ghost block the mentee already positioned
      const match = initialWindow
        ? (opts.find(o => o.startTime === initialWindow.startTime) ?? opts[0])
        : opts[0];
      if (match) {
        const key = `${match.startTime}|${match.endTime}`;
        setTimeFrame(key);
        onPreviewChange(match.startTime, match.endTime);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot?.id]);

  function handleTimeFrameChange(v: string) {
    setTimeFrame(v);
    const [st, et] = v.split("|");
    onPreviewChange(st, et);
  }

  async function book() {
    if (!slot) return;
    if (!sessionId) { setErr("Please select a session to discuss."); return; }
    const [requestedStart, requestedEnd] = timeFrame.split("|");
    setSaving(true);
    try {
      await onBook(slot.id, { sessionId, requestedStart, requestedEnd, message: msg });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to request");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !slot) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold font-[family-name:var(--font-heading)]">Request Slot</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400">
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">{fmtDate(slot.date)} · {slot.startTime}–{slot.endTime}</p>

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="space-y-4">
          {/* Session selector — required */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Session to discuss <span className="text-red-400">*</span>
            </label>
            <select
              value={sessionId}
              onChange={e => { setSessionId(e.target.value); setErr(""); }}
              className="input-field w-full text-sm"
            >
              <option value="">Select a session…</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  Session {s.sessionNum}: {s.topic}{s.status === "completed" ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Time-frame selector — only shown when slot > 90 min */}
          {timeFrameOptions.length > 1 && (
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">
                90-min window
              </label>
              <select
                value={timeFrame}
                onChange={e => handleTimeFrameChange(e.target.value)}
                className="input-field w-full text-sm"
              >
                {timeFrameOptions.map(opt => {
                  const key = `${opt.startTime}|${opt.endTime}`;
                  return (
                    <option key={key} value={key}>
                      {opt.startTime} – {opt.endTime}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Message — optional */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Message <span className="text-gray-300">(optional)</span>
            </label>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={2}
              placeholder="Any notes for your mentor?"
              className="input-field w-full resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          <button onClick={book} disabled={saving || !sessionId} className="btn-primary flex-1 text-sm py-2">
            {saving ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slot popover (click existing slot) ────────────────────────────────────
function SlotPopover({ slot, role, x, y, color, requestedWindow, onClose, onEdit, onDelete, onBook, onAccept, onReject }: {
  slot: Slot; role: string; x: number; y: number;
  color?: string;
  requestedWindow?: { startTime: string; endTime: string };
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBook?: () => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  const { left, top } = calcPopoverPos(x, y, 272, 380);
  const bgClass = color ? "" : slotBg(slot, role);
  const bgStyle = color ? { backgroundColor: color } : {};
  const pending = (slot.bookings || []).filter(b => b.status === "pending");
  const myBooking = slot.myBooking;

  return (
    <div ref={ref} className="fixed z-[60] bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
      style={{ left, top, width: 272 }}>
      <div className={`${bgClass} text-white px-4 py-3`} style={bgStyle}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">
              {requestedWindow
                ? `${requestedWindow.startTime} – ${requestedWindow.endTime}`
                : `${slot.startTime} – ${slot.endTime}`}
            </p>
            <p className="text-xs opacity-75 mt-0.5">{fmtDate(slot.date)}</p>
          </div>
          <button onClick={onClose} className="opacity-70 hover:opacity-100 transition flex-shrink-0 mt-0.5">
            <Icon name="x" size={14} />
          </button>
        </div>
        {slot.notes && <p className="text-xs opacity-70 mt-1.5 leading-snug">{slot.notes}</p>}
      </div>

      <div className="p-3 space-y-2.5">
        {role === "mentor" && (
          <div className="flex gap-1.5">
            <button onClick={() => { onEdit?.(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs btn-ghost px-2 py-1.5 rounded-lg">
              <Icon name="edit" size={13} /> Edit
            </button>
            <button onClick={() => { onDelete?.(); onClose(); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-red-500 border border-red-100 hover:bg-red-50 transition">
              <Icon name="trash" size={13} /> Delete
            </button>
          </div>
        )}

        {role === "mentor" && pending.length > 0 && (
          <div className="border-t border-gray-100 pt-2.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Requests ({pending.length})
            </p>
            <div className="space-y-2">
              {pending.map(b => (
                <div key={b.id} className="bg-gray-50 rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={b.mentee?.name || "?"} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{b.mentee?.name}</p>
                      {b.requestedStart && b.requestedEnd && (
                        <p className="text-[11px] text-blue-600 font-medium truncate">{b.requestedStart}–{b.requestedEnd}</p>
                      )}
                      {b.message && (
                        <p className="text-[11px] text-gray-400 italic truncate">&ldquo;{b.message}&rdquo;</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { onAccept?.(b.id); onClose(); }}
                      className="btn-primary text-xs px-2 py-1 flex-1">Accept</button>
                    <button onClick={() => { onReject?.(b.id); onClose(); }}
                      className="text-xs px-2 py-1 flex-1 rounded border border-gray-200 hover:bg-gray-100 transition text-gray-500">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === "mentee" && (
          <>
            {!myBooking && slot.status === "available" && (
              <button onClick={() => onBook?.()} className="btn-primary w-full text-sm py-2">
                Request this slot
              </button>
            )}
            {myBooking && (
              <div className="flex items-center gap-2 py-0.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  myBooking.status === "accepted" ? "bg-emerald-500" :
                  myBooking.status === "rejected" ? "bg-red-400" : "bg-amber-400"
                }`} />
                <p className="text-xs text-gray-700 font-medium">
                  {myBooking.status === "accepted" ? "Booking accepted ✓" :
                   myBooking.status === "rejected" ? "Request rejected" : "Request pending…"}
                </p>
              </div>
            )}
            {!myBooking && slot.status !== "available" && (
              <p className="text-xs text-gray-400 py-0.5">This slot is {slot.status}.</p>
            )}
          </>
        )}

        {role === "admin" && slot.mentor && (
          <div className="flex items-center gap-2.5 py-0.5">
            <Avatar name={slot.mentor.name} size="sm" />
            <div>
              <p className="text-xs font-medium">{slot.mentor.name}</p>
              <p className="text-xs text-gray-400">{slot.mentor.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { user } = useUser();
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [weekStart, setWeekStart]   = useState<Date>(() => getWeekStart(new Date()));
  // Inline create panel (Google Calendar style — no backdrop)
  const [createPanel, setCreatePanel] = useState<CreatePanel | null>(null);
  // Edit modal (center modal, backdrop — only for editing)
  const [editModal, setEditModal]   = useState<{
    open: boolean;
    initial?: { id?: string; date?: string; startTime?: string; endTime?: string; notes?: string | null };
  }>({ open: false });
  const [popover, setPopover]       = useState<{ slot: Slot; x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Slot | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [bookTarget, setBookTarget] = useState<Slot | null>(null);
  const [menteeGhost, setMenteeGhost] = useState<MenteeGhost | null>(null);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [hasPairing, setHasPairing] = useState(true);
  const [mentorFilter, setMentorFilter] = useState("");
  const [mentors, setMentors]       = useState<MentorOption[]>([]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today    = toDateStr(new Date());

  // Stable mentor → hex color map (rebuilt whenever slot list changes)
  const mentorColorMap = useMemo(() => buildMentorColorMap(slots), [slots]);

  // ── Fetch
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const url  = user?.role === "admin" && mentorFilter
      ? `/api/schedule?mentorId=${mentorFilter}`
      : "/api/schedule";
    const res  = await fetch(url);
    const data = await res.json();
    setSlots(data.slots || []);
    if (data.hasPairing !== undefined) setHasPairing(data.hasPairing);
    if (data.sessions) setSessions(data.sessions);
    setLoading(false);
  }, [user?.role, mentorFilter]);

  useEffect(() => { if (user) fetchSlots(); }, [user, fetchSlots]);

  useEffect(() => {
    if (user?.role === "admin")
      fetch("/api/users?role=mentor").then(r => r.json()).then(d => setMentors(d.users || []));
  }, [user?.role]);

  const weekDateStrs = weekDays.map(toDateStr);
  const weekSlots    = slots.filter(s => weekDateStrs.includes(s.date));

  // ── Actions
  async function handleSaveNew(d: { date: string; startTime: string; endTime: string; notes: string }) {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    await fetchSlots();
  }

  async function handleSaveEdit(d: { date: string; startTime: string; endTime: string; notes: string }) {
    const id  = editModal.initial?.id;
    const res = await fetch(`/api/schedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    await fetchSlots();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/schedule/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    await fetchSlots();
  }

  async function handleBook(slotId: string, opts: { sessionId: string; requestedStart: string; requestedEnd: string; message: string }) {
    const res = await fetch(`/api/schedule/${slotId}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to request");
    await fetchSlots();
  }

  async function handleBookingAction(slotId: string, bookingId: string, action: "accept" | "reject") {
    await fetch(`/api/schedule/${slotId}/book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, action }),
    });
    await fetchSlots();
  }

  // ── Click on empty cell → open inline create panel + ghost block
  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    if (user?.role !== "mentor") return;
    if (popover) { setPopover(null); return; }
    if (createPanel) { setCreatePanel(null); return; }

    const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY    = e.clientY - rect.top;
    const snapped = Math.floor((relY / HOUR_H) * 60 / 30) * 30; // snap to 30-min
    const startH  = HOUR_START + Math.floor(snapped / 60);
    const startM  = snapped % 60;
    if (startH >= HOUR_END) return;

    setCreatePanel({
      date:      dateStr,
      startTime: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      endTime:   `${String(Math.min(startH + 1, HOUR_END)).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      x: e.clientX,
      y: e.clientY,
    });
  }

  // ── Click existing slot → show slot popover + snap ghost to click position
  function handleSlotClick(e: React.MouseEvent, slot: Slot) {
    e.stopPropagation();
    setCreatePanel(null);
    setPopover({ slot, x: e.clientX, y: e.clientY });

    if (user?.role === "mentee" && slot.status === "available" && !slot.myBooking) {
      const slotStartMins = toMins(slot.startTime);
      const slotEndMins   = toMins(slot.endTime);

      // Calculate which 30-min-snapped start the click maps to within the slot
      const rect    = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relY    = e.clientY - rect.top;
      const clickedMins = slotStartMins + (relY / HOUR_H) * 60;
      const snapped = Math.round(clickedMins / 30) * 30;

      // Clamp so the 90-min window always fits inside the slot
      const maxStart  = Math.max(slotStartMins, slotEndMins - 90);
      const ghostStart = Math.max(slotStartMins, Math.min(snapped, maxStart));
      const ghostEnd   = minsToTime(Math.min(ghostStart + 90, slotEndMins));

      setMenteeGhost({ date: slot.date, startTime: minsToTime(ghostStart), endTime: ghostEnd });
    } else {
      setMenteeGhost(null);
    }
  }

  // ── Mentee ghost preview live update (when time-frame changes in BookingModal)
  const handlePreviewChange = useCallback((startTime: string, endTime: string) => {
    setMenteeGhost(g => g ? { ...g, startTime, endTime } : null);
  }, []);

  // ── Ghost block live update (when time inputs in InlineCreateCard change)
  const handleUpdateCreateTime = useCallback((st: string, et: string) => {
    setCreatePanel(p => p ? { ...p, startTime: st, endTime: et } : null);
  }, []);

  if (!user) return null;

  const isMentor     = user.role === "mentor";
  const isMentee     = user.role === "mentee";
  const isAdmin      = user.role === "admin";
  const pendingCount = slots.reduce((n, s) => n + (s.bookings?.filter(b => b.status === "pending").length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isMentor && "Click any empty time slot to add your availability."}
            {isMentee && "Click a slot to request a session with your mentor."}
            {isAdmin  && "View all mentor schedules."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && mentors.length > 0 && (
            <select value={mentorFilter} onChange={e => setMentorFilter(e.target.value)}
              className="input-field text-sm py-1.5">
              <option value="">All Mentors</option>
              {mentors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {isMentor && pendingCount > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200">
              <Icon name="bell" size={13} />
              {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            </span>
          )}
        </div>
      </div>

      {/* Week toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="btn-ghost text-sm px-3 py-1.5 font-medium"
        >
          Today
        </button>
        <div className="flex">
          <button onClick={() => setWeekStart(d => addDays(d, -7))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <Icon name="chevron-left" size={16} />
          </button>
          <button onClick={() => setWeekStart(d => addDays(d, 7))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
        <span className="text-base font-semibold text-gray-800">
          {weekStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
      </div>

      {/* No pairing (mentee) */}
      {isMentee && !hasPairing && (
        <div className="card text-center py-14 text-gray-400">
          <Icon name="calendar" size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No active pairing found.</p>
          <p className="text-xs mt-1">You&apos;ll see your mentor&apos;s availability once you&apos;re paired.</p>
        </div>
      )}

      {/* Calendar */}
      {(!isMentee || hasPairing) && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div style={{ minWidth: 640 }}>

              {/* Day headers */}
              <div className="grid border-b border-gray-100"
                style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                <div className="border-r border-gray-100" />
                {weekDays.map((day, i) => {
                  const ds      = toDateStr(day);
                  const isToday = ds === today;
                  return (
                    <div key={i} className={`text-center py-3 border-r border-gray-100 last:border-r-0 ${isToday ? "bg-blue-50/40" : ""}`}>
                      <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">
                        {DAY_ABBR[day.getDay()]}
                      </p>
                      <div className={`text-lg font-bold mt-0.5 w-9 h-9 flex items-center justify-center rounded-full mx-auto leading-none ${
                        isToday ? "bg-blue-600 text-white" : "text-gray-800"
                      }`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              {loading ? (
                <div className="p-6"><div className="h-80 bg-gray-50 rounded-lg animate-pulse" /></div>
              ) : (
                <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>

                  {/* Hour labels */}
                  <div className="border-r border-gray-100">
                    {Array.from({ length: TOTAL_H }, (_, i) => (
                      <div key={i} style={{ height: HOUR_H }}
                        className="relative border-b border-gray-50 last:border-b-0">
                        <span className="absolute -top-2.5 right-2 text-[10px] text-gray-400 select-none">
                          {fmtHour(HOUR_START + i)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, dayIdx) => {
                    const dateStr   = toDateStr(day);
                    const isToday   = dateStr === today;
                    const daySlots  = weekSlots.filter(s => s.date === dateStr);
                    const hasGhost  = createPanel?.date === dateStr;
                    const layout    = computeDayLayout(daySlots);

                    return (
                      <div
                        key={dayIdx}
                        className={`relative border-r border-gray-100 last:border-r-0 ${isToday ? "bg-blue-50/20" : ""} ${isMentor ? "cursor-pointer" : ""}`}
                        style={{ height: TOTAL_H * HOUR_H }}
                        onClick={e => handleCellClick(e, dateStr)}
                      >
                        {/* Hour grid lines */}
                        {Array.from({ length: TOTAL_H }, (_, i) => (
                          <div key={i} className="absolute left-0 right-0 border-t border-gray-100"
                            style={{ top: i * HOUR_H }} />
                        ))}
                        {/* Half-hour lines */}
                        {Array.from({ length: TOTAL_H }, (_, i) => (
                          <div key={`h${i}`} className="absolute left-0 right-0 border-t border-gray-50"
                            style={{ top: i * HOUR_H + HOUR_H / 2 }} />
                        ))}

                        {/* Hover tint */}
                        {isMentor && (
                          <div className="absolute inset-0 hover:bg-blue-500/5 transition-colors pointer-events-none" />
                        )}

                        {/* Current time */}
                        {isToday && <NowLine />}

                        {/* ── Ghost block (mentor in-progress creation) ── */}
                        {hasGhost && createPanel && (() => {
                          const { top, height } = slotPos(createPanel.startTime, createPanel.endTime);
                          return (
                            <div
                              className="absolute left-0.5 right-0.5 rounded-md pointer-events-none overflow-hidden"
                              style={{ top, height }}
                            >
                              <div className="absolute inset-0 bg-blue-200/70" />
                              <div className="absolute inset-0 rounded-md border-2 border-dashed border-blue-500" />
                              <p className="relative text-[11px] font-semibold text-blue-700 px-2 pt-1 truncate leading-tight">
                                {createPanel.startTime}–{createPanel.endTime}
                              </p>
                            </div>
                          );
                        })()}

                        {/* ── Ghost block (mentee 90-min booking preview) ── */}
                        {isMentee && menteeGhost?.date === dateStr && (() => {
                          const { top, height } = slotPos(menteeGhost.startTime, menteeGhost.endTime);
                          return (
                            <div
                              className="absolute left-0.5 right-0.5 rounded-md pointer-events-none overflow-hidden z-[5]"
                              style={{ top, height }}
                            >
                              <div className="absolute inset-0 bg-blue-400/30" />
                              <div className="absolute inset-0 rounded-md border-2 border-dashed border-blue-600" />
                            </div>
                          );
                        })()}

                        {/* Slot blocks — column-aware layout handles overlaps */}
                        {layout.map(({ slot, col, totalCols }) => {
                          const { top, height } = slotPos(slot.startTime, slot.endTime);
                          const pct         = 100 / totalCols;
                          const slotPending = (slot.bookings || []).filter(b => b.status === "pending");
                          const isSelected  = popover?.slot.id === slot.id;

                          const mentorColor = isAdmin && slot.mentorId
                            ? (mentorColorMap.get(slot.mentorId) ?? MENTOR_PALETTE[0])
                            : undefined;

                          // Build segments: only the booked window gets status color, rest stays blue
                          const segments = getVisualSegments(slot, user.role);

                          return (
                            <div
                              key={slot.id}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => handleSlotClick(e, slot)}
                              className={`absolute text-white rounded-md overflow-hidden transition-all select-none ${
                                isMentor || isMentee || isAdmin ? "cursor-pointer" : ""
                              } ${isSelected ? "ring-2 ring-white/50" : "hover:brightness-110 active:brightness-95"}`}
                              style={{
                                top, height,
                                left:  `calc(${col * pct}% + 2px)`,
                                width: `calc(${pct}% - 4px)`,
                              }}
                            >
                              {/* Colored segment strips */}
                              {segments.map((seg, idx) => {
                                const segTop = ((toMins(seg.startTime) - toMins(slot.startTime)) / 60) * HOUR_H;
                                const segH   = ((toMins(seg.endTime) - toMins(seg.startTime)) / 60) * HOUR_H;
                                const bgCls  = mentorColor ? "" :
                                  seg.type === "pending"  ? "bg-amber-400" :
                                  seg.type === "accepted" || seg.type === "booked" ? "bg-emerald-500" :
                                  seg.type === "available" ? "bg-blue-600" : "bg-gray-400";
                                return (
                                  <div key={idx} className={`absolute left-0 right-0 ${bgCls}`}
                                    style={{ top: segTop, height: segH, ...(mentorColor ? { backgroundColor: mentorColor } : {}) }} />
                                );
                              })}

                              {/* Text + badge overlay */}
                              <div className="relative z-10 px-2 py-1">
                                <p className="text-[11px] font-semibold truncate leading-tight">
                                  {slot.startTime}–{slot.endTime}
                                </p>
                                {height > 38 && slot.notes && (
                                  <p className="text-[10px] opacity-70 truncate mt-0.5">{slot.notes}</p>
                                )}
                                {isAdmin && slot.mentor && (
                                  <p className="text-[10px] opacity-80 truncate mt-0.5">{slot.mentor.name}</p>
                                )}
                                {isMentor && slotPending.length > 0 && (
                                  <span className="absolute top-1 right-1 w-4 h-4 bg-white/90 rounded-full flex items-center justify-center shadow-sm">
                                    <span className="text-[9px] font-bold text-amber-600">{slotPending.length}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 px-0.5">
        {isMentor && (
          <>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />Pending request</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />Booked</span>
            <span className="text-gray-300 ml-1">· Click any empty area to add a slot</span>
          </>
        )}
        {isMentee && (
          <>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" />Available</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />Your request pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />Accepted</span>
          </>
        )}
        {isAdmin && mentors.length > 0 && (
          <>
            {mentors.map(m => {
              const color = mentorColorMap.get(m.id);
              if (!color) return null;
              return (
                <span key={m.id} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded inline-block flex-shrink-0"
                    style={{ backgroundColor: color }} />
                  {m.name}
                </span>
              );
            })}
          </>
        )}
      </div>

      {/* ── Inline create card (Google Calendar style — no blur) ── */}
      {createPanel && (
        <InlineCreateCard
          panel={createPanel}
          onClose={() => setCreatePanel(null)}
          onSave={handleSaveNew}
          onUpdateTime={handleUpdateCreateTime}
        />
      )}

      {/* ── Slot detail popover ── */}
      {popover && (
        <SlotPopover
          slot={popover.slot}
          role={user.role}
          x={popover.x}
          y={popover.y}
          color={isAdmin && popover.slot.mentorId ? mentorColorMap.get(popover.slot.mentorId) : undefined}
          requestedWindow={menteeGhost ?? undefined}
          onClose={() => { setPopover(null); setMenteeGhost(null); }}
          onEdit={() => setEditModal({ open: true, initial: { ...popover.slot, id: popover.slot.id } })}
          onDelete={() => setDeleteTarget(popover.slot)}
          onBook={() => { setBookTarget(popover.slot); setPopover(null); /* keep menteeGhost alive for modal */ }}
          onAccept={id => handleBookingAction(popover.slot.id, id, "accept")}
          onReject={id => handleBookingAction(popover.slot.id, id, "reject")}
        />
      )}

      {/* ── Modals ── */}
      <EditSlotModal
        open={editModal.open}
        initial={editModal.initial}
        onClose={() => setEditModal({ open: false })}
        onSave={handleSaveEdit}
      />
      <BookingModal
        open={!!bookTarget}
        slot={bookTarget}
        sessions={sessions}
        initialWindow={menteeGhost ?? undefined}
        onClose={() => { setBookTarget(null); setMenteeGhost(null); }}
        onBook={handleBook}
        onPreviewChange={handlePreviewChange}
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete slot?"
        description={deleteTarget
          ? `Delete the slot on ${fmtDate(deleteTarget.date)} (${deleteTarget.startTime}–${deleteTarget.endTime})? Any pending bookings will be notified.`
          : ""}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
