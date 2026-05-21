"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { formatJakartaDateTime } from "@/lib/datetime-id";

/**
 * Top banner that surfaces the upcoming call: countdown pill + Google
 * Meet join button + copy-link. Only rendered when lead has a
 * callScheduledAt in the future (or already started).
 *
 * Countdown pill colors:
 *   - green   = >30 min away
 *   - amber   = <30 min away (with pulse)
 *   - red     = call started / overdue (with pulse)
 */

interface Props {
  scheduledAt: string;       // ISO string
  completedAt?: string | null;  // set when admin marked call completed
  meetLink?: string | null;  // optional Google Meet URL
  interviewer?: string | null;
  durationMin?: number;      // defaults to 30
}

function diffMinutes(target: Date): number {
  return Math.round((target.getTime() - Date.now()) / 60_000);
}

/** Parse Supabase-style timestamps (no `Z`) as UTC, not local. */
function parseAsUtc(s: string): Date {
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? new Date(s) : new Date(s + "Z");
}

export default function CallBanner({ scheduledAt, completedAt, meetLink, interviewer, durationMin = 30 }: Props) {
  const target = parseAsUtc(scheduledAt);
  const [minutesLeft, setMinutesLeft] = useState(() => diffMinutes(target));

  // Refresh every 30s so the pill stays current.
  useEffect(() => {
    const id = setInterval(() => setMinutesLeft(diffMinutes(target)), 30_000);
    return () => clearInterval(id);
  }, [target]);

  // Admin explicitly marking the call completed wins over the clock —
  // even a future-dated callScheduledAt should read "selesai" once
  // there's a callCompletedAt on the lead.
  const isCompleted = !!completedAt;
  const isStarted = !isCompleted && minutesLeft <= 0 && minutesLeft > -durationMin;
  const isOver = !isCompleted && minutesLeft <= -durationMin;
  const isClose = !isCompleted && minutesLeft <= 30 && minutesLeft > 0;

  const pillBg = isCompleted ? "bg-emerald-100 text-emerald-800"
    : isStarted ? "bg-red-600 text-white"
    : isOver ? "bg-zinc-200 text-zinc-700"
    : isClose ? "bg-amber-100 text-amber-900"
    : "bg-emerald-100 text-emerald-800";

  const pillText = isCompleted
    ? `Call selesai · ${formatJakartaDateTime(parseAsUtc(completedAt))}`
    : isStarted ? "Call sedang berlangsung"
    : isOver ? "Call selesai (jadwal lewat — admin belum mark completed)"
    : isClose ? `Mulai ${minutesLeft} menit lagi`
    : minutesLeft > 1440
      ? `Mulai ${Math.floor(minutesLeft / 1440)} hari lagi`
      : `Mulai ${Math.floor(minutesLeft / 60)}j ${minutesLeft % 60}m lagi`;

  const stamp = formatJakartaDateTime(target);

  function copyMeetLink() {
    if (meetLink) navigator.clipboard.writeText(meetLink).catch(() => {});
  }

  return (
    <div
      className="rounded-2xl px-5 py-3.5 flex items-center gap-4 flex-wrap"
      style={{
        background: "linear-gradient(135deg, #edf1fa 0%, #fefaef 100%)",
        border: "1px solid #b9c9eb",
      }}
    >
      <div className="w-11 h-11 rounded-lg bg-primary text-white inline-flex items-center justify-center flex-shrink-0">
        <Icon name="calendar" size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="font-bold text-[15px] text-foreground font-[family-name:var(--font-heading)]">
            Initial Call
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${pillBg}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full bg-current ${(isClose || isStarted) ? "animate-pulse" : ""}`}
            />
            {pillText}
          </span>
        </div>
        <div className="text-[12.5px] text-text-muted mt-1 flex gap-3.5 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar" size={12} />
            {stamp} · {durationMin} menit
          </span>
          {interviewer && (
            <span className="inline-flex items-center gap-1">
              <Icon name="user" size={12} />
              Interviewer: <strong className="text-foreground font-semibold">{interviewer}</strong>
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {meetLink && (
          <>
            <button
              type="button"
              onClick={copyMeetLink}
              className="btn-ghost text-xs inline-flex items-center gap-1.5"
              title={meetLink}
            >
              <Icon name="link" size={13} />
              Salin link
            </button>
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: "#0f9d58" }}
            >
              <Icon name="video" size={14} />
              Join Meet
            </a>
          </>
        )}
      </div>
    </div>
  );
}
