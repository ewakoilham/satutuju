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
  | "needs_review"     // Phase 15: classificationReviewedAt IS NULL
  | "new"
  | "wait"
  | "engaged"
  | "hot"
  | "call_done"
  | "waitlist"
  | "deposit_pending"
  | "deposit_agreed"
  | "deposit_paid"
  | "review"           // legacy: bucket = unclassified (couldn't even infer country)
  | "won"
  | "closed";

interface SegmentDef {
  id: SegmentId;
  label: string;
  icon: string;
  /** Tailwind text color class for the icon when not active. */
  iconColor: string;
  buckets: LeadBucket[];   // empty = no filter
  stages: LeadStage[];     // empty = no filter
  /** Phase 15: when true, segment also implies `reviewed=false`
   *  filter on the list endpoint. */
  unreviewedOnly?: boolean;
}

export const SEGMENTS: SegmentDef[] = [
  { id: "all",             label: "Semua",                       icon: "inbox",    iconColor: "text-text-muted-2", buckets: [], stages: [] },
  // Phase 15: top-priority segment — admin can't kirim outreach (auto or
  // manual) until each lead's auto-classification is confirmed. Pinned
  // at the top in amber so it stands out at first glance.
  { id: "needs_review",    label: "Butuh review klasifikasi",    icon: "flag",     iconColor: "text-amber-600",    buckets: [], stages: [], unreviewedOnly: true },
  { id: "new",             label: "Belum dikontak",              icon: "sparkles", iconColor: "text-primary",      buckets: [], stages: ["new"] },
  // Legacy "Butuh review" = bucket=unclassified (rare cases where even
  // country couldn't be inferred). Renamed to disambiguate from the new
  // Phase 15 review-gate segment above.
  { id: "review",          label: "Klasifikasi unclassified",    icon: "flag",     iconColor: "text-slate-500",    buckets: ["unclassified"], stages: [] },
  { id: "wait",            label: "Menunggu respons",            icon: "clock",    iconColor: "text-text-muted-2", buckets: [], stages: ["outreach_sent"] },
  { id: "engaged",         label: "Engaged",                     icon: "fire",     iconColor: "text-orange-600",   buckets: [], stages: ["whatsapp_read", "email_opened", "email_clicked"] },
  { id: "hot",             label: "Siap call",                   icon: "flag",     iconColor: "text-violet-600",   buckets: [], stages: ["call_scheduled"] },
  { id: "call_done",       label: "Call selesai",                icon: "check",    iconColor: "text-violet-500",   buckets: [], stages: ["call_completed"] },
  { id: "waitlist",        label: "Waitlist",                    icon: "clock",    iconColor: "text-amber-600",    buckets: [], stages: ["waitlist"] },
  { id: "deposit_pending", label: "Menunggu konfirmasi deposit", icon: "clock",    iconColor: "text-amber-600",    buckets: [], stages: ["deposit_pending"] },
  { id: "deposit_agreed",  label: "Bersedia membayar deposit",   icon: "tag",      iconColor: "text-lime-600",     buckets: [], stages: ["deposit_agreed"] },
  { id: "deposit_paid",    label: "Deposit lunas",                icon: "check",    iconColor: "text-emerald-600",  buckets: [], stages: ["deposit_paid"] },
  { id: "won",             label: "Lolos seleksi",               icon: "check",    iconColor: "text-emerald-600",  buckets: [], stages: ["matched"] },
  { id: "closed",          label: "Tidak lanjut",                icon: "x",        iconColor: "text-slate-500",    buckets: [], stages: ["declined", "rejected"] },
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
    <aside className="w-[200px] flex-shrink-0 bg-surface border border-border rounded-xl p-1.5 self-start">
      {/* Smart segments */}
      {SEGMENTS.map((s) => {
        const isActive = active === s.id;
        const count = segmentCounts[s.id] ?? 0;
        // Phase 15: needs_review segment uses amber styling when it
        // has a non-zero count, so admin can't miss it even when
        // scanning the sidebar at a glance.
        const isUrgent = s.id === "needs_review" && count > 0;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSegmentClick(s.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[12.5px] transition mb-px ${
              isActive
                ? isUrgent
                  ? "bg-amber-100 text-amber-900 font-semibold"
                  : "bg-primary-50 text-primary font-semibold"
                : isUrgent
                  ? "bg-amber-50 text-amber-900 hover:bg-amber-100 font-semibold"
                  : "text-foreground hover:bg-surface-elevated/60 font-medium"
            }`}
          >
            <Icon
              name={s.icon}
              size={13}
              className={
                isActive
                  ? isUrgent ? "text-amber-700" : "text-primary"
                  : isUrgent ? "text-amber-700" : s.iconColor
              }
            />
            <span className="flex-1 truncate">{s.label}</span>
            <span
              className={`text-[11px] font-semibold tabular-nums min-w-[18px] text-center px-1.5 py-px rounded ${
                isUrgent
                  ? "text-amber-900 bg-amber-200/70"
                  : isActive
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
