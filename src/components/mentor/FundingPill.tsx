"use client";

import Icon from "@/components/ui/Icon";
import { fundingPlanLabelId } from "@/lib/leads/types";

/**
 * Phase 16 — colored funding pill for mentor leads list rows.
 *
 * Three funding plans mapped to three semantic colors:
 *   scholarship → emerald (good news — fully funded)
 *   partial     → amber   (mixed)
 *   self_funded → slate   (neutral)
 */

interface Props {
  funding: string;
  size?: "sm" | "md";
}

const FUNDING_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  scholarship: { bg: "bg-emerald-50", fg: "text-emerald-800", border: "border-emerald-200" },
  partial:     { bg: "bg-amber-50",   fg: "text-amber-800",   border: "border-amber-200" },
  self_funded: { bg: "bg-slate-50",   fg: "text-slate-700",   border: "border-slate-200" },
};

const FALLBACK = { bg: "bg-zinc-50", fg: "text-zinc-700", border: "border-zinc-200" };

export default function FundingPill({ funding, size = "sm" }: Props) {
  if (!funding) return null;
  const c = FUNDING_COLORS[funding] ?? FALLBACK;
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${c.bg} ${c.fg} ${c.border} ${pad} font-medium whitespace-nowrap`}
    >
      <Icon name="tag" size={size === "sm" ? 10 : 11} />
      {fundingPlanLabelId(funding)}
    </span>
  );
}
