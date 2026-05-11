"use client";

import Icon from "@/components/ui/Icon";
import type { ContractTocEntry } from "@/components/contract/ContractTOC";
import {
  findPasalTakeaway,
  type ContractTakeaway,
} from "@/lib/contract-takeaways";

interface ContractTakeawaysProps {
  entries: ContractTocEntry[];
  activeId: string | null;
  /** Render shell — `"sidebar"` (sticky right-rail on lg+) or `"disclosure"`
   *  (collapsible `<details>` for narrower viewports). */
  variant?: "sidebar" | "disclosure";
  className?: string;
}

/**
 * Side panel that surfaces mentor-actionable highlights for the pasal the
 * reader is currently scrolled to.
 *
 * Sync is driven entirely by `activeId` (owned by the page via
 * `useActiveAnchor`). On `disclosure` variant we render a `<details>`
 * wrapper for narrower viewports so the panel doesn't compete with the
 * preview for horizontal space.
 */
export default function ContractTakeaways({
  entries,
  activeId,
  variant = "sidebar",
  className,
}: ContractTakeawaysProps) {
  const takeaway = findPasalTakeaway(activeId, entries);

  if (variant === "disclosure") {
    return (
      <details
        className={`rounded-xl border border-border bg-surface-elevated ${
          className ?? ""
        }`}
        open
      >
        <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon name="star" size={14} className="text-primary" />
            Poin penting{takeaway ? ` — ${takeaway.pasalLabel}` : ""}
            {takeaway?.bullets && (
              <span className="text-xs text-text-muted-2 font-normal">
                ({takeaway.bullets.length})
              </span>
            )}
          </span>
          <Icon
            name="chevron-down"
            size={14}
            className="text-text-muted-2 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="px-4 pb-4">
          <TakeawayBody takeaway={takeaway} />
        </div>
      </details>
    );
  }

  return (
    <aside
      className={`rounded-xl border border-border bg-surface-elevated p-4 ${
        className ?? ""
      }`}
      aria-label="Poin penting kontrak"
    >
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-text-muted-2 mb-1">
        Poin Penting
      </p>
      {takeaway ? (
        <p className="text-sm font-semibold text-foreground mb-3">
          {takeaway.pasalLabel}
        </p>
      ) : (
        <p className="text-sm font-semibold text-foreground mb-3">
          Belum di dalam pasal
        </p>
      )}
      <TakeawayBody takeaway={takeaway} />
    </aside>
  );
}

function TakeawayBody({ takeaway }: { takeaway: ContractTakeaway | null }) {
  if (!takeaway) {
    return (
      <p className="text-xs text-text-muted leading-relaxed">
        Gulir ke salah satu pasal untuk melihat poin tindakan kunci yang
        relevan bagi mentor.
      </p>
    );
  }

  if (takeaway.flavour === "informational") {
    return (
      <p className="text-xs text-text-muted leading-relaxed italic">
        Bagian ini sebagian besar normatif/formalitas. Tidak ada poin
        tindakan khusus untuk mentor — namun tetap mengikat secara hukum
        seperti pasal-pasal lainnya.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {(takeaway.bullets ?? []).map((b, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}
