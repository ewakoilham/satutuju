"use client";

import Icon from "@/components/ui/Icon";

/**
 * Phase 16 — KPI tile on the mentor leads triage stream.
 *
 * Four of these render across the top of the inbox (Lead masuk hari ini /
 * Cocok negaraku / Admin balas catatanmu / Sudah kamu tandai). Each
 * tile is clickable and acts as a shortcut to the corresponding filter
 * chip in the chip row below.
 *
 * `accent` is the per-tile color theme — a tiny background + icon color
 * pair so each KPI has a glance-distinct identity (blue = today, amber =
 * unread admin reply, etc.).
 */

interface Props {
  label: string;
  value: number;
  hint?: string;
  icon: string;
  /** "primary" | "amber" | "violet" | "orange" — keyed by intent so we
   *  don't sprinkle hex strings across the call sites. */
  accent: "primary" | "amber" | "violet" | "orange";
  active?: boolean;
  onClick?: () => void;
}

const ACCENT_STYLES: Record<Props["accent"], { bg: string; fg: string }> = {
  primary: { bg: "bg-primary-50", fg: "text-primary" },
  violet:  { bg: "bg-violet-100", fg: "text-violet-700" },
  amber:   { bg: "bg-amber-100", fg: "text-amber-700" },
  orange:  { bg: "bg-orange-100", fg: "text-orange-700" },
};

export default function MentorStatTile({
  label, value, hint, icon, accent, active = false, onClick,
}: Props) {
  const a = ACCENT_STYLES[accent];
  const interactive = typeof onClick === "function";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`flex-1 min-w-0 text-left p-3.5 rounded-xl border transition ${
        active
          ? "bg-surface border-primary-200 shadow-[inset_0_0_0_1px_var(--color-primary-200,#b9c9eb)]"
          : "bg-surface border-border hover:border-primary-200"
      } ${interactive ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${a.bg} ${a.fg}`}>
          <Icon name={icon} size={14} />
        </span>
        <span className="text-[12px] text-text-muted font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-heading)] font-extrabold text-[26px] text-foreground leading-none tracking-tight tabular-nums">
          {value}
        </span>
        {hint && <span className="text-[11.5px] text-text-muted-2 truncate">{hint}</span>}
      </div>
    </button>
  );
}
