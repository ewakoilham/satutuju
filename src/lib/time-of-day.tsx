import type { ReactNode } from "react";

/** Time-of-day phases used by the Beranda greeting. Hours are inclusive on
 *  the lower bound, exclusive on the upper bound: pagi is 04:00–09:59, etc. */
export type TodPhase = "pagi" | "siang" | "sore" | "malam";

export interface TodConfig {
  phase: TodPhase;
  greet: string;
  /** CSS class on the icon wrapper — controls the color of the inline SVG via currentColor. */
  toneClass: "tod-amber" | "tod-saffron" | "tod-sunset" | "tod-night";
}

const CONFIGS: Record<TodPhase, Omit<TodConfig, "phase">> = {
  pagi:  { greet: "Selamat pagi",  toneClass: "tod-amber"   },
  siang: { greet: "Selamat siang", toneClass: "tod-saffron" },
  sore:  { greet: "Selamat sore",  toneClass: "tod-sunset"  },
  malam: { greet: "Selamat malam", toneClass: "tod-night"   },
};

export function phaseFromHour(hour: number): TodPhase {
  if (hour >= 4 && hour < 10) return "pagi";
  if (hour >= 10 && hour < 15) return "siang";
  if (hour >= 15 && hour < 18) return "sore";
  return "malam";
}

export function todConfig(phase: TodPhase): TodConfig {
  return { phase, ...CONFIGS[phase] };
}

/** SVGs match the design handoff (Beranda Hi-Fi A.html). They render at 32×32
 *  and rely on `currentColor` so the wrapper's tone class controls the hue. */
export function TodIcon({ phase }: { phase: TodPhase }): ReactNode {
  switch (phase) {
    case "pagi":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="16" cy="17" r="5" fill="currentColor" />
          <path d="M16 7 V4 M6 17 H3 M29 17 H26 M9 10 L7 8 M23 10 L25 8" />
        </svg>
      );
    case "siang":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="16" cy="16" r="6" fill="currentColor" />
          <path d="M16 4 V1 M16 31 V28 M4 16 H1 M31 16 H28 M7.5 7.5 L5.5 5.5 M24.5 7.5 L26.5 5.5 M7.5 24.5 L5.5 26.5 M24.5 24.5 L26.5 26.5" />
        </svg>
      );
    case "sore":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 24 H29" strokeWidth="1.5" />
          <path d="M9 24 a7 7 0 0 1 14 0" fill="currentColor" stroke="none" />
          <path d="M9 24 a7 7 0 0 1 14 0" />
          <path d="M16 11 V8 M6 17 L4 16 M26 17 L28 16 M9 12 L7.5 10.5 M23 12 L24.5 10.5" />
        </svg>
      );
    case "malam":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 18 a8 8 0 1 1 -8 -12 a6 6 0 0 0 8 12 z" fill="currentColor" />
          <path d="M25 8 l0.6 1.6 L27 10 l-1.4 0.4 L25 12 l-0.6 -1.6 L23 10 l1.4 -0.4 z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

/** WIB (Asia/Jakarta) is UTC+7 year-round (no DST). We derive the hour from
 *  the current instant manually rather than rely on `Date` constructor
 *  locale, which depends on the browser's timezone. */
export function currentWibHour(now: Date = new Date()): number {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const wib = new Date(utcMs + 7 * 60 * 60_000);
  return wib.getHours();
}
