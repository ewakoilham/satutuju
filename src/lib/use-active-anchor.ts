"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which heading (by `id`) is the most recent one the reader has
 * scrolled past — "active section" in the conventional doc-site sense.
 *
 * Implementation note: an IntersectionObserver with `root: scrollContainer`
 * sounds tidy but only fires when the user scrolls the INNER container.
 * Our preview is `max-h-[60vh]` and many readers scroll the outer page
 * instead, leaving the inner scroll untouched — the observer never fires
 * and the active id stays stuck at null. Falling back to a getBoundingClientRect
 * snapshot on every scroll event (window + inner) handles both modes
 * uniformly and is well under 1ms for a couple dozen headings.
 *
 * @param scrollContainer The scrollable container the headings live in.
 *   Pass `null` to skip the inner-scroll listener.
 * @param headingIds Stable list of heading `id` attributes to track.
 */
export function useActiveAnchor(
  scrollContainer: HTMLElement | null,
  headingIds: string[],
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headingIds.length === 0) return;

    function pick(): void {
      // The "active line" sits a little below whichever is visible: the
      // scroll container's top edge (when the container is still on
      // screen) or the top of the viewport (when the reader has scrolled
      // the outer page past the container). Without the `Math.max(0,…)`,
      // a container above the viewport gives `baseTop < 0` and the band
      // walks off-screen entirely, freezing the active id.
      const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
      const visibleTop = Math.max(0, containerTop);
      const activeY = visibleTop + 64;

      let bestId: string | null = null;
      let bestDelta = -Infinity; // most negative = farthest back
      for (const id of headingIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        const delta = top - activeY;
        // Only consider headings already crossed (delta ≤ 0); among those,
        // the one closest to the line (least negative delta) wins.
        if (delta <= 0 && delta > bestDelta) {
          bestDelta = delta;
          bestId = id;
        }
      }
      setActiveId((prev) => (prev === bestId ? prev : bestId));
    }

    // Listen on both window AND the inner scroll container so we update
    // regardless of which one the reader is actually scrolling.
    window.addEventListener("scroll", pick, { passive: true });
    scrollContainer?.addEventListener("scroll", pick, { passive: true });
    // Resize changes the active line position, so recompute.
    window.addEventListener("resize", pick);
    // One initial pass so we land on the right answer without the reader
    // having to scroll first.
    pick();
    return () => {
      window.removeEventListener("scroll", pick);
      scrollContainer?.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [scrollContainer, headingIds]);

  return activeId;
}
