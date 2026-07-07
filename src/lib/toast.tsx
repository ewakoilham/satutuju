"use client";

/**
 * Minimal toast primitive — no library, no config. One global queue, max 3
 * visible, auto-dismiss, click to dismiss. Mounted once in the dashboard
 * layout via <Toaster />.
 *
 * Use it ONLY where a silent failure would mislead the user (a save that
 * didn't save, a load that left a wrong empty state). Background/decorative
 * fetches should keep failing silently — noise is worse than silence.
 */

import { useEffect, useState } from "react";

export interface ToastItem {
  id: number;
  kind: "error" | "success";
  text: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  for (const l of listeners) l([...items]);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastItem["kind"], text: string) {
  const t: ToastItem = { id: nextId++, kind, text };
  items = [...items.slice(-2), t];
  emit();
  setTimeout(() => dismiss(t.id), 6000);
}

export const toast = {
  error: (text: string) => push("error", text),
  success: (text: string) => push("success", text),
};

export function Toaster() {
  const [visible, setVisible] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.push(setVisible);
    return () => {
      listeners = listeners.filter((l) => l !== setVisible);
    };
  }, []);
  if (visible.length === 0) return null;
  return (
    <div className="st-toasts" role="status" aria-live="polite">
      {visible.map((t) => (
        <button key={t.id} type="button" className={`st-toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </button>
      ))}
    </div>
  );
}
