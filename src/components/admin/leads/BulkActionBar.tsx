"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";

interface Props {
  selectedCount: number;
  /** Distribution of selected leads by bucket — used in the confirm
   *  modal preview (so admin sees what's about to fire). */
  bucketBreakdown: Record<string, number>;
  busy: boolean;
  onSendOutreach: () => void;
  onReclassify: () => void;
  onChangeBucket: () => void;
  onAssignInterviewer: () => void;
  onExportCsv: () => void;
  onClear: () => void;
}

/**
 * Sticky bottom action bar that appears whenever ≥1 row is selected
 * in the leads table. Exposes the full bulk-action menu:
 *
 *   Send outreach   — POST /api/new-leads/bulk-outreach (with confirm modal)
 *   Re-classify     — POST /api/new-leads/bulk-classify
 *   Move bucket     — POST /api/new-leads/bulk-change-bucket (modal)
 *   Assign interviewer — POST /api/new-leads/bulk-assign-interviewer
 *   Export CSV      — GET  /api/new-leads/export?ids=...
 *
 * The primary CTA (Send outreach) stays as a solid button; the rest
 * collapse under a "More actions" dropdown to keep the bar compact
 * on smaller screens.
 */
export default function BulkActionBar({
  selectedCount,
  bucketBreakdown,
  busy,
  onSendOutreach,
  onReclassify,
  onChangeBucket,
  onAssignInterviewer,
  onExportCsv,
  onClear,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (selectedCount === 0) return null;

  // Order matches LEAD_BUCKETS for predictable display.
  const order = ["A", "B", "C", "D", "incomplete", "domestic", "unclassified"] as const;
  const breakdown = order
    .filter((b) => (bucketBreakdown[b] ?? 0) > 0)
    .map((b) => ({ bucket: b, n: bucketBreakdown[b] }));

  function runAndClose(fn: () => void) {
    setMenuOpen(false);
    fn();
  }

  return (
    <div className="sticky bottom-4 z-30 flex justify-center pointer-events-none">
      <div className="pointer-events-auto card shadow-lg border-border bg-surface px-4 py-2.5 flex items-center gap-4 flex-wrap max-w-3xl">
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
            <Icon name="mail" size={12} />
            {busy ? "Mengirim…" : "Reachout"}
          </button>

          {/* "More actions" dropdown to keep the bar compact. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              className="btn-ghost text-xs inline-flex items-center gap-1.5"
            >
              More actions
              <Icon name={menuOpen ? "chevron-down" : "chevron-right"} size={12} />
            </button>
            {menuOpen && (
              <div
                className="absolute bottom-full mb-2 right-0 w-56 bg-surface border border-border rounded-lg shadow-lg overflow-hidden text-xs"
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => runAndClose(onReclassify)}
                  className="block w-full text-left px-3 py-2 hover:bg-surface-elevated transition"
                >
                  <Icon name="refresh" size={12} className="inline mr-1.5" />
                  Re-classify
                </button>
                <button
                  type="button"
                  onClick={() => runAndClose(onChangeBucket)}
                  className="block w-full text-left px-3 py-2 hover:bg-surface-elevated transition"
                >
                  <Icon name="edit" size={12} className="inline mr-1.5" />
                  Move bucket…
                </button>
                <button
                  type="button"
                  onClick={() => runAndClose(onAssignInterviewer)}
                  className="block w-full text-left px-3 py-2 hover:bg-surface-elevated transition"
                >
                  <Icon name="user" size={12} className="inline mr-1.5" />
                  Assign interviewer…
                </button>
                <button
                  type="button"
                  onClick={() => runAndClose(onExportCsv)}
                  className="block w-full text-left px-3 py-2 hover:bg-surface-elevated transition border-t border-border/60"
                >
                  <Icon name="download" size={12} className="inline mr-1.5" />
                  Export CSV
                </button>
              </div>
            )}
          </div>

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
