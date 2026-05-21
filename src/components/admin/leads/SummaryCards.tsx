"use client";

import { useEffect, useState } from "react";
import LeadBucketBadge from "./LeadBucketBadge";
import LeadStageBadge from "./LeadStageBadge";
import { LEAD_BUCKETS, type LeadBucket, type LeadStage } from "@/lib/leads/types";

interface Stats {
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

/**
 * Top-of-page summary cards. Four panels:
 *
 *  1. Total + bucket distribution
 *  2. Stage distribution (top 4 stages)
 *  3. Email engagement (sent / open rate / click rate)
 *  4. Conversion funnel (horizontal bars showing absolute count + %)
 *
 * Data sourced from /api/new-leads/stats which aggregates server-side
 * (one round-trip instead of 7 separate count queries).
 */
export default function SummaryCards({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/new-leads/stats", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        setStats(await res.json());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (error) {
    return (
      <div className="card p-3 text-xs text-danger">
        Stats error: {error}
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 h-28 bg-surface-elevated/40" />
        ))}
      </div>
    );
  }

  const { total, bucketCounts, stageCounts, funnel } = stats;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const openRate = funnel.sent === 0 ? 0 : Math.round((funnel.opened / funnel.sent) * 100);
  const clickRate = funnel.opened === 0 ? 0 : Math.round((funnel.clicked / funnel.opened) * 100);

  // Top stages by count for the second card. Ordered by LEAD_STAGES so
  // the funnel progression is visually intuitive.
  const STAGE_ORDER: LeadStage[] = [
    "new", "outreach_sent", "whatsapp_read", "email_opened", "email_clicked",
    "call_scheduled", "call_completed", "deposit_paid", "matched",
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1: Total + bucket */}
      <div className="card p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-text-muted-2">Total leads</div>
        <div className="text-2xl font-extrabold text-foreground">{total}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {LEAD_BUCKETS.map((b) => (
            <span key={b} className="inline-flex items-center gap-1">
              <LeadBucketBadge bucket={b as LeadBucket} />
              <span className="text-text-muted">{bucketCounts[b] ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Card 2: Stage distribution */}
      <div className="card p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-text-muted-2">Funnel stages</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {STAGE_ORDER.map((s) => {
            const n = stageCounts[s] ?? 0;
            if (n === 0) return null;
            return (
              <span key={s} className="inline-flex items-center gap-1">
                <LeadStageBadge stage={s} />
                <span className="text-text-muted">{n}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Card 3: Email engagement */}
      <div className="card p-4 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-text-muted-2">Email engagement</div>
        <div className="text-2xl font-extrabold text-foreground">{funnel.sent}</div>
        <div className="text-[11px] text-text-muted-2">sent total</div>
        <div className="flex items-baseline gap-4 text-xs pt-1 border-t border-border/60">
          <span>
            <span className="font-semibold text-emerald-700">{openRate}%</span>
            <span className="text-text-muted-2"> open ({funnel.opened})</span>
          </span>
          <span>
            <span className="font-semibold text-blue-700">{clickRate}%</span>
            <span className="text-text-muted-2"> click ({funnel.clicked})</span>
          </span>
        </div>
      </div>

      {/* Card 4: Conversion funnel viz */}
      <div className="card p-4 space-y-1.5">
        <div className="text-[11px] uppercase tracking-wider text-text-muted-2">Conversion funnel</div>
        {[
          { label: "Total", count: funnel.total, color: "bg-zinc-300" },
          { label: "Sent", count: funnel.sent, color: "bg-blue-200" },
          { label: "Opened", count: funnel.opened, color: "bg-blue-400" },
          { label: "Call sched.", count: funnel.callScheduled, color: "bg-violet-400" },
          { label: "Matched", count: funnel.matched, color: "bg-emerald-500" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 text-text-muted-2 flex-shrink-0">{row.label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div className={`h-full ${row.color}`} style={{ width: `${pct(row.count)}%` }} />
            </div>
            <span className="w-8 text-right text-foreground font-medium tabular-nums">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
