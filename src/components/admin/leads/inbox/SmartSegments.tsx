"use client";

import Icon from "@/components/ui/Icon";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import type { LeadBucket, LeadStage } from "@/lib/leads/types";

/**
 * Left sidebar of the Smart Inbox. Two stacked sections:
 *   1. Smart segments — curated views (replace the legacy chip wall).
 *      Each segment maps to a specific (bucket + stage) filter combo.
 *   2. Bucket filter list — quick toggle for the 6 main buckets, with
 *      the per-bucket count shown.
 *
 * The parent owns filter state and just receives onSegmentClick callbacks.
 */

export type SegmentId =
  | "all"
  | "new"
  | "wait"
  | "engaged"
  | "hot"
  | "deposit_pending"
  | "deposit_paid"
  | "review"
  | "won";

interface SegmentDef {
  id: SegmentId;
  label: string;
  icon: string;
  /** Tailwind text color class for the icon when not active. */
  iconColor: string;
  buckets: LeadBucket[];   // empty = no filter
  stages: LeadStage[];     // empty = no filter
}

export const SEGMENTS: SegmentDef[] = [
  { id: "all",             label: "Semua",                       icon: "inbox",    iconColor: "text-text-muted-2", buckets: [], stages: [] },
  { id: "new",             label: "Belum dikontak",              icon: "sparkles", iconColor: "text-primary",      buckets: [], stages: ["new"] },
  { id: "wait",            label: "Menunggu respons",            icon: "clock",    iconColor: "text-text-muted-2", buckets: [], stages: ["outreach_sent"] },
  { id: "engaged",         label: "Engaged",                     icon: "fire",     iconColor: "text-orange-600",   buckets: [], stages: ["whatsapp_read", "email_opened", "email_clicked"] },
  { id: "hot",             label: "Hot — siap call",             icon: "flag",     iconColor: "text-violet-600",   buckets: [], stages: ["call_scheduled", "call_completed"] },
  { id: "deposit_pending", label: "Menunggu konfirmasi deposit", icon: "clock",    iconColor: "text-amber-600",    buckets: [], stages: ["deposit_pending"] },
  { id: "deposit_paid",    label: "Bersedia membayar deposit",   icon: "tag",      iconColor: "text-emerald-600",  buckets: [], stages: ["deposit_paid"] },
  { id: "review",          label: "Butuh review",                icon: "flag",     iconColor: "text-slate-500",    buckets: ["unclassified"], stages: [] },
  { id: "won",             label: "Lolos seleksi",               icon: "check",    iconColor: "text-emerald-600",  buckets: [], stages: ["matched"] },
];

const BUCKET_DESC: Record<LeadBucket, string> = {
  A: "Mentor + partner kampus",
  B: "Hanya mentor",
  C: "Hanya partner kampus",
  D: "Tidak ada keduanya",
  incomplete: "Form belum lengkap",
  domestic: "Target dalam negeri",
  unclassified: "Perlu review",
};

const SIDEBAR_BUCKETS: LeadBucket[] = ["A", "B", "C", "D", "incomplete", "domestic"];

interface Props {
  active: SegmentId;
  segmentCounts: Record<SegmentId, number>;
  bucketCounts: Record<string, number>;
  onSegmentClick: (id: SegmentId) => void;
  onBucketClick: (bucket: LeadBucket) => void;
  activeBuckets: Set<LeadBucket>;
}

export default function SmartSegments({
  active,
  segmentCounts,
  bucketCounts,
  onSegmentClick,
  onBucketClick,
  activeBuckets,
}: Props) {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface border border-border rounded-xl p-1.5 self-start">
      {/* Smart segments */}
      {SEGMENTS.map((s) => {
        const isActive = active === s.id;
        const count = segmentCounts[s.id] ?? 0;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSegmentClick(s.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[12.5px] transition mb-px ${
              isActive
                ? "bg-primary-50 text-primary font-semibold"
                : "text-foreground hover:bg-surface-elevated/60 font-medium"
            }`}
          >
            <Icon name={s.icon} size={13} className={isActive ? "text-primary" : s.iconColor} />
            <span className="flex-1 truncate">{s.label}</span>
            <span
              className={`text-[11px] font-semibold tabular-nums min-w-[18px] text-center px-1.5 py-px rounded ${
                isActive
                  ? "text-primary bg-transparent"
                  : "text-text-muted-2 bg-surface-elevated/80"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="h-px bg-border/60 my-1.5" />

      {/* Bucket section */}
      <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-muted-2">
        Bucket
      </div>
      {SIDEBAR_BUCKETS.map((b) => {
        const isActive = activeBuckets.has(b);
        return (
          <button
            key={b}
            type="button"
            onClick={() => onBucketClick(b)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[12px] transition ${
              isActive ? "bg-primary-50/60" : "hover:bg-surface-elevated/60"
            }`}
          >
            <LeadBucketBadge bucket={b} />
            <span className="flex-1 truncate text-foreground">{BUCKET_DESC[b]}</span>
            <span className="text-[11px] text-text-muted-2 tabular-nums">{bucketCounts[b] ?? 0}</span>
          </button>
        );
      })}
    </aside>
  );
}
