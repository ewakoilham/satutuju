"use client";

import Icon from "@/components/ui/Icon";

/**
 * Phase 16 — colored country pill for mentor leads list rows.
 *
 * The current mentor leads page shows country as plain muted text. The
 * design replaces that with a tinted pill so the eye can sort visually
 * by destination region. Color is deterministic from a small palette
 * keyed on country name so a given country always gets the same tint
 * across renders.
 *
 * No-op when country is null/empty (renders nothing — caller decides
 * whether to show a "Belum jelas" placeholder).
 */

interface Props {
  country: string | null | undefined;
  size?: "sm" | "md";
}

// Deterministic palette. Pre-mapped for the countries we know about;
// unknown countries get a stable hash-derived index.
const KNOWN_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  "Australia":       { bg: "bg-sky-50",     fg: "text-sky-800",     border: "border-sky-200" },
  "United Kingdom":  { bg: "bg-indigo-50",  fg: "text-indigo-800",  border: "border-indigo-200" },
  "New Zealand":     { bg: "bg-teal-50",    fg: "text-teal-800",    border: "border-teal-200" },
  "Netherlands":     { bg: "bg-orange-50",  fg: "text-orange-800",  border: "border-orange-200" },
  "Canada":          { bg: "bg-rose-50",    fg: "text-rose-800",    border: "border-rose-200" },
  "United States":   { bg: "bg-blue-50",    fg: "text-blue-800",    border: "border-blue-200" },
  "Germany":         { bg: "bg-yellow-50",  fg: "text-yellow-900",  border: "border-yellow-200" },
  "Singapore":       { bg: "bg-emerald-50", fg: "text-emerald-800", border: "border-emerald-200" },
  "Japan":           { bg: "bg-pink-50",    fg: "text-pink-800",    border: "border-pink-200" },
  "South Korea":     { bg: "bg-fuchsia-50", fg: "text-fuchsia-800", border: "border-fuchsia-200" },
  "France":          { bg: "bg-violet-50",  fg: "text-violet-800",  border: "border-violet-200" },
  "Switzerland":     { bg: "bg-red-50",     fg: "text-red-800",     border: "border-red-200" },
  "Sweden":          { bg: "bg-amber-50",   fg: "text-amber-800",   border: "border-amber-200" },
  "Ireland":         { bg: "bg-lime-50",    fg: "text-lime-800",    border: "border-lime-200" },
  "Hong Kong":       { bg: "bg-cyan-50",    fg: "text-cyan-800",    border: "border-cyan-200" },
};

const FALLBACK_PALETTE = [
  { bg: "bg-slate-100",   fg: "text-slate-700",   border: "border-slate-300" },
  { bg: "bg-zinc-100",    fg: "text-zinc-700",    border: "border-zinc-300" },
  { bg: "bg-stone-100",   fg: "text-stone-700",   border: "border-stone-300" },
  { bg: "bg-neutral-100", fg: "text-neutral-700", border: "border-neutral-300" },
];

function colorFor(country: string) {
  if (KNOWN_COLORS[country]) return KNOWN_COLORS[country];
  // Cheap deterministic hash so unknown countries get a stable index.
  let h = 0;
  for (let i = 0; i < country.length; i++) h = (h * 31 + country.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

export default function CountryPill({ country, size = "sm" }: Props) {
  if (!country) return null;
  const c = colorFor(country);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${c.bg} ${c.fg} ${c.border} ${pad} font-medium whitespace-nowrap`}
    >
      <Icon name="globe" size={size === "sm" ? 10 : 11} />
      {country}
    </span>
  );
}
