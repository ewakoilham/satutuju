"use client";

import { useRef, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { calcPopoverPos, fmtDateLong, toMins, minsToTime, buildBusy, clampToFreeGap, clampEndToGap } from "./helpers";
import type { Slot } from "./types";

const MIN_MINS = 60;
const MAX_MINS = 90;

interface InlineCreateCardProps {
  date: string;
  startTime: string;
  endTime: string;
  anchorX: number;
  anchorY: number;
  /** Existing slots on this day (to enforce no-overlap) */
  existingSlots: Slot[];
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  onClose: () => void;
  onUpdateTime: (st: string, et: string) => void;
}

export default function InlineCreateCard({
  date, startTime, endTime, anchorX, anchorY, existingSlots,
  onSave, onClose, onUpdateTime,
}: InlineCreateCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt]       = useState(startTime);
  const [et, setEt]       = useState(endTime);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  useEffect(() => { setSt(startTime); }, [startTime]);
  useEffect(() => { setEt(endTime); }, [endTime]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 10);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  function changeSt(v: string) {
    if (!v) return;
    const busy = buildBusy(existingSlots);
    const result = clampToFreeGap(toMins(v), busy, MIN_MINS, MAX_MINS);
    if (!result) {
      setErr("No 60-min free gap available at this time.");
      return;
    }
    const newSt = minsToTime(result.start);
    const newEt = minsToTime(result.end);
    setSt(newSt);
    setEt(newEt);
    setErr("");
    onUpdateTime(newSt, newEt);
  }

  function changeEt(v: string) {
    if (!v) return;
    const startMins = toMins(st);
    const busy = buildBusy(existingSlots);
    const clamped = clampEndToGap(startMins, toMins(v), busy, MIN_MINS, MAX_MINS);
    const newEt = minsToTime(clamped);
    setEt(newEt);

    const dur = clamped - startMins;
    if (dur < MIN_MINS) {
      setErr("Not enough free time. Minimum 60 minutes required.");
    } else if (toMins(v) !== clamped) {
      setErr("End time adjusted — cannot overlap an existing slot.");
    } else {
      setErr("");
    }
    onUpdateTime(st, newEt);
  }

  const durMins = st && et ? toMins(et) - toMins(st) : 0;
  const durOk   = durMins >= MIN_MINS && durMins <= MAX_MINS;
  const durLabel = durMins > 0 ? `${durMins} min` : "";

  async function save() {
    if (!st || !et) { setErr("Start and end time required."); return; }
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
              {durLabel} &middot; 60&ndash;90 min only
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
