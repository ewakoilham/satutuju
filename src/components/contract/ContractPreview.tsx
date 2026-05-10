"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface ContractPreviewProps {
  /** Pre-rendered HTML produced server-side via marked.parse(). */
  html: string;
  /** Fired the first time the user scrolls within ~24px of the bottom. */
  onScrolledToEnd?: () => void;
  /** Tailwind utility override for the scroll container. */
  className?: string;
}

/**
 * Scrollable contract reader. Forwards a ref to the inner scroll container
 * so a sibling component (e.g. <ContractTOC />) can drive scroll-to-anchor
 * navigation inside it.
 */
const ContractPreview = forwardRef<HTMLDivElement, ContractPreviewProps>(
  function ContractPreview(
    { html, onScrolledToEnd, className },
    ref,
  ) {
    const innerRef = useRef<HTMLDivElement>(null);
    const firedRef = useRef(false);

    useImperativeHandle(ref, () => innerRef.current as HTMLDivElement, []);

    useEffect(() => {
      const el = innerRef.current;
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
        ref={innerRef}
        className={
          className ??
          "contract-prose max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 md:p-8"
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);

export default ContractPreview;
