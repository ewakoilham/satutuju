"use client";

import { useEffect, useRef } from "react";

interface ContractPreviewProps {
  /** Pre-rendered HTML produced server-side via marked.parse(). */
  html: string;
  /** Fired the first time the user scrolls within ~24px of the bottom. */
  onScrolledToEnd?: () => void;
}

/**
 * Scrollable contract reader. The parent feeds in already-sanitised HTML
 * (rendered server-side from the interpolated markdown) and we own only
 * the layout, typography, and the "scrolled to end" detection.
 */
export default function ContractPreview({ html, onScrolledToEnd }: ContractPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onScrolledToEnd) return;
    function check() {
      if (!el || firedRef.current) return;
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (remaining <= 24) {
        firedRef.current = true;
        onScrolledToEnd?.();
      }
    }
    el.addEventListener("scroll", check, { passive: true });
    // Run once in case content is short enough to already be at end.
    check();
    return () => el.removeEventListener("scroll", check);
  }, [onScrolledToEnd]);

  return (
    <div
      ref={ref}
      className="contract-prose max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 md:p-8"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
