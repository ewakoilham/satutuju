"use client";

import { useState, useEffect, useMemo } from "react";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { fmtDate, getTimeFrameOptions } from "./helpers";
import type { Slot, Session } from "./types";

interface BookingModalProps {
  open: boolean;
  slot: Slot | null;
  sessions: Session[];
  /** Pre-selected window from the ghost block position */
  initialWindow?: { startTime: string; endTime: string };
  onClose: () => void;
  onBook: (slotId: string, opts: {
    sessionId: string;
    requestedStart: string;
    requestedEnd: string;
    message: string;
  }) => Promise<void>;
  /** Live-update ghost block when user changes time-frame selector */
  onPreviewChange: (startTime: string, endTime: string) => void;
}

export default function BookingModal({
  open, slot, sessions, initialWindow,
  onClose, onBook, onPreviewChange,
}: BookingModalProps) {
  const [sessionId, setSessionId] = useState("");
  const [timeFrame, setTimeFrame] = useState("");
  const [msg, setMsg]             = useState("");
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState("");

  const timeFrameOptions = useMemo(
    () => slot ? getTimeFrameOptions(slot.startTime, slot.endTime) : [],
    [slot]
  );

  // Reset form when modal opens for a new slot
  useEffect(() => {
    if (open && slot) {
      setSessionId("");
      setMsg("");
      setErr("");
      const opts = getTimeFrameOptions(slot.startTime, slot.endTime);
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
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-[family-name:var(--font-heading)]">Request Slot</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-elevated transition text-text-muted-2">
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Slot info card — full width */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Time slot</p>
            <p className="text-lg font-bold text-blue-700 leading-none">{slot.startTime} &ndash; {slot.endTime}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Date</p>
            <p className="text-sm font-semibold text-blue-700">{fmtDate(slot.date)}</p>
          </div>
        </div>

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="space-y-4">
          {/* Session selector */}
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">
              Session to discuss <span className="text-red-400">*</span>
            </label>
            <Select
              value={sessionId}
              onChange={(v) => { setSessionId(v); setErr(""); }}
              options={[
                { value: "", label: "Select a session\u2026" },
                ...sessions.map(s => ({
                  value: s.id,
                  label: `Session ${s.sessionNum}: ${s.topic}${s.status === "completed" ? " \u2713" : ""}`,
                })),
              ]}
              className="w-full text-sm"
            />
          </div>

          {/* Time-frame selector (only when slot > 90 min) */}
          {timeFrameOptions.length > 1 && (
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">
                90-min window
              </label>
              <Select
                value={timeFrame}
                onChange={(v) => handleTimeFrameChange(v)}
                options={timeFrameOptions.map(opt => {
                  const key = `${opt.startTime}|${opt.endTime}`;
                  return { value: key, label: `${opt.startTime} \u2013 ${opt.endTime}` };
                })}
                className="w-full text-sm"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">
              Message <span className="text-text-muted-2">(optional)</span>
            </label>
            <textarea value={msg} onChange={e => setMsg(e.target.value)}
              rows={2} placeholder="Any notes for your mentor?"
              className="input-field w-full resize-none text-sm" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
          <button onClick={book} disabled={saving || !sessionId}
            className="btn-primary flex-1 text-sm py-2">
            {saving ? "Sending\u2026" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
