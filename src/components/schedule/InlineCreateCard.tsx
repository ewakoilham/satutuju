"use client";

import { useRef, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { calcPopoverPos, fmtDateLong, toMins, minsToTime } from "./helpers";

const MIN_MINS = 60;
const MAX_MINS = 90;

interface InlineCreateCardProps {
  date: string;
  startTime: string;
  endTime: string;
  anchorX: number;
  anchorY: number;
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  onClose: () => void;
  onUpdateTime: (st: string, et: string) => void;
}

export default function InlineCreateCard({
  date, startTime, endTime, anchorX, anchorY,
  onSave, onClose, onUpdateTime,
}: InlineCreateCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt]       = useState(startTime);
  const [et, setEt]       = useState(endTime);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  // Sync from parent on mount
  useEffect(() => { setSt(startTime); }, [startTime]);
  useEffect(() => { setEt(endTime); }, [endTime]);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  // When start changes: preserve current duration (clamped to 60–90 min)
  function changeSt(v: string) {
    if (!v) return;
    const startMins = toMins(v);
    const prevDur   = toMins(et) - toMins(st);
    const clampedDur = Math.max(MIN_MINS, Math.min(MAX_MINS, prevDur || MIN_MINS));
    const newEnd = minsToTime(startMins + clampedDur);
    setSt(v);
    setEt(newEnd);
    setErr("");
    onUpdateTime(v, newEnd);
  }

  // When end changes: clamp to [start+60, start+90] automatically
  function changeEt(v: string) {
    if (!v) return;
    const startMins = toMins(st);
    const endMins   = toMins(v);
    const dur = endMins - startMins;
    if (dur < MIN_MINS) {
      const clamped = minsToTime(startMins + MIN_MINS);
      setEt(clamped);
      setErr("Minimum slot duration is 60 minutes.");
      onUpdateTime(st, clamped);
    } else if (dur > MAX_MINS) {
      const clamped = minsToTime(startMins + MAX_MINS);
      setEt(clamped);
      setErr("Maximum slot duration is 90 minutes.");
      onUpdateTime(st, clamped);
    } else {
      setEt(v);
      setErr("");
      onUpdateTime(st, v);
    }
  }

  // Duration indicator
  const durMins = st && et ? toMins(et) - toMins(st) : 0;
  const durOk   = durMins >= MIN_MINS && durMins <= MAX_MINS;
  const durLabel = durMins > 0 ? `${durMins} min` : "";

  async function save() {
    if (!st || !et) { setErr("Start and end time required."); return; }
    if (st >= et)   { setErr("Start must be before end."); return; }
    const dur = toMins(et) - toMins(st);
    if (dur < MIN_MINS) { setErr("Minimum slot duration is 60 minutes."); return; }
    if (dur > MAX_MINS) { setErr("Maximum slot duration is 90 minutes."); return; }
    setSaving(true);
    try { await onSave({ date, startTime: st, endTime: et, notes }); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  const { left, top } = calcPopoverPos(anchorX, anchorY, 280, 280);

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
      style={{ left, top, width: 280 }}
    >
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
        <p className="text-sm font-semibold text-gray-800 leading-tight">{fmtDateLong(date)}</p>

        {/* Time row + duration badge */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input type="time" value={st} onChange={e => changeSt(e.target.value)}
              className="input-field text-sm py-1.5 flex-1 min-w-0" />
            <span className="text-gray-400 text-sm flex-shrink-0">&ndash;</span>
            <input type="time" value={et} onChange={e => changeEt(e.target.value)}
              className="input-field text-sm py-1.5 flex-1 min-w-0" />
          </div>
          {durLabel && (
            <p className={`text-[11px] font-medium text-right pr-0.5 ${durOk ? "text-blue-500" : "text-amber-500"}`}>
              {durLabel} &middot; 60&ndash;90 min slots only
            </p>
          )}
        </div>

        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Add notes (optional)" className="input-field w-full text-sm"
          onKeyDown={e => { if (e.key === "Enter") save(); }} />

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-1.5">Cancel</button>
          <button onClick={save} disabled={saving || !durOk} className="btn-primary flex-1 text-sm py-1.5 disabled:opacity-50">
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
