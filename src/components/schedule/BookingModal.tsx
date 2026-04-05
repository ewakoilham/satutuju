"use client";

import { useState, useEffect, useMemo } from "react";
import Icon from "@/components/ui/Icon";
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold font-[family-name:var(--font-heading)] mb-2">Request Slot</h2>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-xl font-bold text-blue-700 leading-none tracking-tight">
                {slot.startTime}&ndash;{slot.endTime}
              </p>
              <p className="text-sm font-medium text-blue-500 mt-1">{fmtDate(slot.date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 mt-0.5">
            <Icon name="x" size={16} />
          </button>
        </div>

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="space-y-4">
          {/* Session selector */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Session to discuss <span className="text-red-400">*</span>
            </label>
            <select value={sessionId}
              onChange={e => { setSessionId(e.target.value); setErr(""); }}
              className="input-field w-full text-sm">
              <option value="">Select a session&hellip;</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  Session {s.sessionNum}: {s.topic}{s.status === "completed" ? " \u2713" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Time-frame selector (only when slot > 90 min) */}
          {timeFrameOptions.length > 1 && (
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">
                90-min window
              </label>
              <select value={timeFrame}
                onChange={e => handleTimeFrameChange(e.target.value)}
                className="input-field w-full text-sm">
                {timeFrameOptions.map(opt => {
                  const key = `${opt.startTime}|${opt.endTime}`;
                  return (
                    <option key={key} value={key}>
                      {opt.startTime} &ndash; {opt.endTime}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Message */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Message <span className="text-gray-300">(optional)</span>
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
