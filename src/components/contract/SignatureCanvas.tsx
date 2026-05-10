"use client";

import { useImperativeHandle, useRef, useState, forwardRef } from "react";
import SignaturePad from "react-signature-canvas";

export type SignatureCanvasHandle = {
  /** PNG data-URL of the drawn signature, or null if empty. */
  getDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

interface SignatureCanvasProps {
  /** Optional: ARIA label for accessibility. */
  ariaLabel?: string;
  /** Disable drawing (e.g. while submitting). */
  disabled?: boolean;
  /** Fired whenever the canvas transitions between empty / non-empty. */
  onEmptyChange?: (empty: boolean) => void;
}

/**
 * Thin wrapper around react-signature-canvas with two ergonomic touches:
 *
 *  1. Imperative `getDataURL()` so the parent can grab the PNG only at
 *     submit time — no per-stroke re-renders.
 *  2. Tracks empty/non-empty internally so the "Tanda Tangani Kontrak"
 *     button can disable until the mentor has actually drawn something.
 */
const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas({ ariaLabel = "Kanvas tanda tangan", disabled, onEmptyChange }, ref) {
    const padRef = useRef<SignaturePad>(null);
    const [empty, setEmpty] = useState(true);

    function setEmptyAndNotify(next: boolean) {
      setEmpty((prev) => {
        if (prev === next) return prev;
        onEmptyChange?.(next);
        return next;
      });
    }

    useImperativeHandle(ref, () => ({
      getDataURL: () => {
        const pad = padRef.current;
        if (!pad || pad.isEmpty()) return null;
        return pad.toDataURL("image/png");
      },
      clear: () => {
        padRef.current?.clear();
        setEmptyAndNotify(true);
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
    }));

    return (
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="relative aspect-[3/1] w-full rounded-lg border border-dashed border-border bg-background overflow-hidden">
          <SignaturePad
            ref={padRef}
            canvasProps={{
              className: "w-full h-full touch-none",
              "aria-label": ariaLabel,
              style: { cursor: disabled ? "not-allowed" : "crosshair" },
            }}
            onBegin={() => setEmptyAndNotify(false)}
            onEnd={() => setEmptyAndNotify(padRef.current?.isEmpty() ?? true)}
          />
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-text-muted-2">
              Goreskan tanda tangan Anda di sini
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted-2">
          <span>Pastikan tanda tangan jelas dan terbaca</span>
          <button
            type="button"
            disabled={disabled}
            className="text-primary hover:underline disabled:opacity-50"
            onClick={() => {
              padRef.current?.clear();
              setEmptyAndNotify(true);
            }}
          >
            Hapus
          </button>
        </div>
      </div>
    );
  },
);

export default SignatureCanvas;
