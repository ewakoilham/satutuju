"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { toMins, minsToTime, buildBusy, clampToFreeGap, clampEndToGap } from "./helpers";
import type { Slot } from "./types";

const MIN_MINS = 60;
const MAX_MINS = 90;

interface EditSlotModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  initial?: { id?: string; date?: string; startTime?: string; endTime?: string; notes?: string | null };
  /** All slots for the same mentor (overlap check — current slot excluded via initial.id) */
  allSlots: Slot[];
}

export default function EditSlotModal({ open, onClose, onSave, initial, allSlots }: EditSlotModalProps) {
  const [date, setDate]     = useState("");
  const [st, setSt]         = useState("");
  const [et, setEt]         = useState("");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  useEffect(() => {
    if (open) {
      setDate(initial?.date || "");
      setSt(initial?.startTime || "");
      setEt(initial?.endTime || "");
      setNotes(initial?.notes || "");
      setErr("");
    }
  }, [open, initial]);

  // Slots on the same date, excluding the current slot being edited
  function getBusy(forDate: string) {
    return buildBusy(
      allSlots.filter(s => s.date === forDate),
      initial?.id
    );
  }

  function changeSt(v: string) {
    if (!v) return;
    const busy = getBusy(date);
    const result = clampToFreeGap(toMins(v), busy, MIN_MINS, MAX_MINS);
    if (!result) { setErr("No 60-min free gap available at this time."); return; }
    setSt(minsToTime(result.start));
    setEt(minsToTime(result.end));
    setErr("");
  }

  function changeEt(v: string) {
    if (!v || !st) return;
    const startMins = toMins(st);
    const busy = getBusy(date);
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
  }

  // When date changes, re-clamp times against the new day's slots
  function changeDate(v: string) {
    setDate(v);
    if (!st || !et || !v) return;
    const busy = buildBusy(allSlots.filter(s => s.date === v), initial?.id);
    const result = clampToFreeGap(toMins(st), busy, MIN_MINS, MAX_MINS);
    if (!result) {
      setErr("No free gap available on this date for the current time. Adjust the time.");
    } else {
      setSt(minsToTime(result.start));
      setEt(minsToTime(result.end));
      setErr("");
    }
  }

  const durMins = st && et ? toMins(et) - toMins(st) : 0;
  const durOk   = durMins >= MIN_MINS && durMins <= MAX_MINS;
  const durLabel = durMins > 0 ? `${durMins} min` : "";

  async function save() {
    if (!date || !st || !et) { setErr("Date, start and end time required."); return; }
    const dur = toMins(et) - toMins(st);
    if (dur < MIN_MINS) { setErr("Minimum slot duration is 60 minutes."); return; }
    if (dur > MAX_MINS) { setErr("Maximum slot duration is 90 minutes."); return; }
    setSaving(true);
    try { await onSave({ date, startTime: st, endTime: et, notes }); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-[family-name:var(--font-heading)]">Edit Slot</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-elevated transition text-text-muted-2">
            <Icon name="x" size={16} />
          </button>
        </div>
        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Date</label>
            <input type="date" value={date} onChange={e => changeDate(e.target.value)} className="input-field w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">Start</label>
              <input type="time" value={st} onChange={e => changeSt(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">End</label>
              <input type="time" value={et} onChange={e => changeEt(e.target.value)} className="input-field w-full" />
            </div>
          </div>
          {durLabel && (
            <p className={`text-[11px] font-medium text-right pr-0.5 -mt-1 ${durOk ? "text-blue-500" : "text-amber-500"}`}>
              {durLabel} &middot; 60&ndash;90 min only
            </p>
          )}
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">
              Notes <span className="text-text-muted-2">(optional)</span>
            </label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. via Google Meet" className="input-field w-full" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          <button onClick={save} disabled={saving || !durOk} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
