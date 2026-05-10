"use client";

import { useEffect, useRef, useState } from "react";

export interface ContractTocEntry {
  id: string;
  text: string;
  depth: number;
}

interface ContractTOCProps {
  entries: ContractTocEntry[];
  /** The scroll container that holds the rendered contract HTML. The TOC
   *  scrolls *inside* this container when the user clicks an entry. If
   *  null, fall back to scrolling the page (used when the preview is
   *  rendered inline without an internal scroll). */
  scrollContainer: HTMLElement | null;
  className?: string;
}

/**
 * Sticky sidebar table-of-contents for the contract reader.
 *
 * Highlights the heading nearest the top of the scroll container as the
 * user reads, and scrolls that container to the matching anchor when an
 * entry is clicked. Falls back to page-level scrolling when no internal
 * container is provided (e.g. on the post-sign "Salinan Perjanjian" view).
 */
export default function ContractTOC({
  entries,
  scrollContainer,
  className,
}: ContractTOCProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Track the topmost heading currently visible in the scroll container
  // (or the viewport if there's no internal container).
  useEffect(() => {
    if (entries.length === 0) return;
    const root: Element | null = scrollContainer ?? null;
    const targets = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => !!el);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        // Pick the most recent intersecting heading; fallback to the last
        // one we passed if none currently overlap the threshold band.
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root,
        rootMargin: "-8px 0px -70% 0px", // active when heading is near the top
        threshold: 0,
      },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [entries, scrollContainer]);

  function jumpTo(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    if (scrollContainer) {
      // Compute target offset relative to the scroll container.
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const next =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 12;
      scrollContainer.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Optimistic active highlight; the IntersectionObserver will reconcile.
    setActiveId(id);
  }

  if (entries.length === 0) return null;

  return (
    <nav
      ref={navRef}
      aria-label="Daftar isi kontrak"
      className={className}
    >
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
