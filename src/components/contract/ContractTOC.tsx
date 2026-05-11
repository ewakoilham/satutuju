"use client";

import { useRef } from "react";

export interface ContractTocEntry {
  id: string;
  text: string;
  depth: number;
}

interface ContractTOCProps {
  entries: ContractTocEntry[];
  /** The scroll container that holds the rendered contract HTML. The TOC
   *  scrolls *inside* this container when the user clicks an entry. If
   *  null, fall back to scrolling the page. */
  scrollContainer: HTMLElement | null;
  /** Active heading id, owned by the page via `useActiveAnchor`. */
  activeId: string | null;
  className?: string;
}

/**
 * Sticky sidebar table-of-contents for the contract reader.
 *
 * "Controlled" — the active-section detection is hoisted to the page
 * level (`useActiveAnchor`) so the sibling `<ContractTakeaways />` can
 * react to the same scroll position without spinning up a second
 * IntersectionObserver.
 */
export default function ContractTOC({
  entries,
  scrollContainer,
  activeId,
  className,
}: ContractTOCProps) {
  const navRef = useRef<HTMLElement>(null);

  function jumpTo(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const next =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 12;
      scrollContainer.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (entries.length === 0) return null;

  return (
    <nav ref={navRef} aria-label="Daftar isi kontrak" className={className}>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-text-muted-2 mb-2 px-1">
        Daftar Isi
      </p>
      <ul className="space-y-0.5 text-xs leading-snug">
        {entries.map((entry) => {
          const active = activeId === entry.id;
          const indent =
            entry.depth === 1
              ? "pl-2"
              : entry.depth === 2
              ? "pl-2"
              : entry.depth === 3
              ? "pl-5"
              : "pl-8";
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => jumpTo(entry.id)}
                className={`block w-full text-left ${indent} pr-2 py-1 rounded transition ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text-muted hover:text-foreground hover:bg-background"
                }`}
              >
                {entry.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
