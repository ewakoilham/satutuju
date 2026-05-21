"use client";

import { useEffect, useState } from "react";

/**
 * 5-cell compact KPI strip that sits above the Smart Inbox list.
 * Saves ~280px vertical vs. the legacy 4-card grid so the lead list
 * is visible above the fold.
 *
 * Reads from /api/new-leads/stats. Refreshes when `refreshKey` bumps
 * (parent bumps it after mutations — sync, bulk send, etc).
 */

interface StatsResponse {
  total: number;
  bucketCounts: Record<string, number>;
  stageCounts: Record<string, number>;
  funnel: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    callScheduled: number;
    callCompleted: number;
    matched: number;
  };
}

interface Props {
  refreshKey: number;
}

const SKELETON_CELLS = [0, 1, 2, 3, 4];

export default function KpiStrip({ refreshKey }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/new-leads/stats", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setStats(j);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border border border-border rounded-xl overflow-hidden">
        {SKELETON_CELLS.map((i) => (
          <div key={i} className="bg-surface px-4 py-3.5">
            <div className="h-3 w-20 bg-surface-elevated rounded animate-pulse" />
            <div className="h-7 w-16 bg-surface-elevated rounded mt-2 animate-pulse" />
            <div className="h-3 w-24 bg-surface-elevated rounded mt-2 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const { funnel, total } = stats;
  const openRate = funnel.sent === 0 ? 0 : Math.round((funnel.opened / funnel.sent) * 100);
  const replyRate = funnel.sent === 0 ? 0 : Math.round((funnel.callScheduled / funnel.sent) * 100);
  const conv = total === 0 ? 0 : Math.round((funnel.matched / total) * 100);
  const sentPct = total === 0 ? 0 : Math.round((funnel.sent / total) * 100);

  const cells: Array<{ label: string; value: string | number; sub: string; color: string }> = [
    { label: "Total leads",            value: total,             sub: `${stats.stageCounts.new ?? 0} belum dikontak`, color: "text-foreground" },
    { label: "Outreach terkirim",      value: funnel.sent,       sub: `${sentPct}% dari total`,                       color: "text-blue-700" },
    { label: "Open rate",              value: `${openRate}%`,    sub: `${funnel.opened} dibuka`,                      color: "text-cyan-700" },
    { label: "Reply / call booked",    value: `${replyRate}%`,   sub: `${funnel.callScheduled} call dijadwalkan`,     color: "text-violet-700" },
    { label: "Konversi → matched",     value: `${conv}%`,        sub: `${funnel.matched} sudah di-pair`,              color: "text-emerald-700" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border border border-border rounded-xl overflow-hidden">
      {cells.map((c, i) => (
        <div key={i} className="bg-surface px-4 py-3.5">
          <div className="text-[10.5px] font-semibold text-text-muted-2 uppercase tracking-[0.06em]">
            {c.label}
          </div>
          <div className={`mt-1 text-[26px] font-extrabold leading-none tabular-nums font-[family-name:var(--font-heading)] ${c.color}`}>
            {c.value}
          </div>
          <div className="mt-1 text-[11px] text-text-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
