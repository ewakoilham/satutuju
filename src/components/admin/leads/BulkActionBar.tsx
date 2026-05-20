"use client";

import Icon from "@/components/ui/Icon";

interface Props {
  selectedCount: number;
  /** Distribution of selected leads by bucket — used in the confirm
   *  modal preview (so admin sees what's about to fire). */
  bucketBreakdown: Record<string, number>;
  busy: boolean;
  onSendOutreach: () => void;
  onClear: () => void;
}

/**
 * Sticky bottom action bar that appears whenever ≥1 row is selected
 * in the leads table. Currently exposes "Send outreach" + "Clear" —
 * Phase 4 will add re-classify / move-bucket / interviewer / CSV.
 */
export default function BulkActionBar({
  selectedCount,
  bucketBreakdown,
  busy,
  onSendOutreach,
  onClear,
}: Props) {
  if (selectedCount === 0) return null;

  // Order matches LEAD_BUCKETS for predictable display.
  const order = ["A", "B", "C", "D", "incomplete", "domestic", "unclassified"] as const;
  const breakdown = order
    .filter((b) => (bucketBreakdown[b] ?? 0) > 0)
    .map((b) => ({ bucket: b, n: bucketBreakdown[b] }));

  return (
    <div className="sticky bottom-4 z-30 flex justify-center pointer-events-none">
      <div className="pointer-events-auto card shadow-lg border-border bg-surface px-4 py-2.5 flex items-center gap-4 flex-wrap max-w-2xl">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">
            {selectedCount} terpilih
          </span>
          {breakdown.length > 0 && (
            <span className="text-[11px] text-text-muted-2">
              ({breakdown.map((b) => `${b.n} ${b.bucket}`).join(" · ")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSendOutreach}
            disabled={busy}
            className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="document" size={12} />
            {busy ? "Mengirim…" : "Send outreach"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="btn-ghost text-xs"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
