"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/ui/Icon";

interface EditSlotModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (d: { date: string; startTime: string; endTime: string; notes: string }) => Promise<void>;
  initial?: { date?: string; startTime?: string; endTime?: string; notes?: string | null };
}

export default function EditSlotModal({ open, onClose, onSave, initial }: EditSlotModalProps) {
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
            {saving ? "Saving\u2026" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
