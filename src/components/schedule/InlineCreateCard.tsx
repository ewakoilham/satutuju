"use client";

import { useRef, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { calcPopoverPos, fmtDateLong } from "./helpers";

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

  // Sync from parent when props change (e.g. re-click different time)
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

  function changeSt(v: string) { setSt(v); onUpdateTime(v, et); }
  function changeEt(v: string) { setEt(v); onUpdateTime(st, v); }

  async function save() {
    if (!st || !et) { setErr("Start and end time required."); return; }
    if (st >= et)   { setErr("Start must be before end."); return; }
    setSaving(true);
    try { await onSave({ date, startTime: st, endTime: et, notes }); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  const { left, top } = calcPopoverPos(anchorX, anchorY, 280, 260);

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

        <div className="flex items-center gap-2">
          <input type="time" value={st} onChange={e => changeSt(e.target.value)}
            className="input-field text-sm py-1.5 flex-1 min-w-0" />
          <span className="text-gray-400 text-sm flex-shrink-0">&ndash;</span>
          <input type="time" value={et} onChange={e => changeEt(e.target.value)}
            className="input-field text-sm py-1.5 flex-1 min-w-0" />
        </div>

        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Add notes (optional)" className="input-field w-full text-sm"
          onKeyDown={e => { if (e.key === "Enter") save(); }} />

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-1.5">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-sm py-1.5">
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
