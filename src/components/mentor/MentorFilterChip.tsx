"use client";

import Icon from "@/components/ui/Icon";

/**
 * Phase 16 — pill-shaped filter chip on the mentor leads triage stream.
 * Used in two rows: semantic chips (Semua / Cocok negaraku / Admin
 * balas / Saya tandai) and country chips (Target Australia · 12 / …).
 *
 * `active` swaps to a primary-tinted treatment; `count` (optional) is
 * shown as a small pill on the right; `dot` (optional) is a 7-px
 * colored dot before the label (red for "unread" cues); `icon`
 * (optional) is a leading icon name.
 */

interface Props {
  label: string;
  count?: number;
  icon?: string;
  dot?: string; // hex color
  active?: boolean;
  onClick?: () => void;
  /** Lets the caller mark a chip as "muted" — e.g. when match=country
   *  isn't available because the mentor's country is unknown. */
  disabled?: boolean;
  title?: string;
}

export default function MentorFilterChip({
  label, count, icon, dot, active = false, onClick, disabled = false, title,
}: Props) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] transition whitespace-nowrap ${
        active
          ? "bg-primary-50 text-primary border-primary-200 font-bold"
          : disabled
            ? "bg-surface text-text-muted-2 border-border opacity-50 cursor-not-allowed font-medium"
            : "bg-surface text-text-muted-2 border-border hover:border-primary-200 hover:text-primary font-medium"
      }`}
    >
      {icon && <Icon name={icon} size={12} />}
      {dot && (
        <span
          className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
      )}
      <span>{label}</span>
      {count != null && (
        <span
          className={`text-[10.5px] font-bold px-1.5 py-px rounded-full tabular-nums ${
            active
              ? "bg-primary text-white"
              : "bg-surface-elevated/70 text-text-muted-2"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
