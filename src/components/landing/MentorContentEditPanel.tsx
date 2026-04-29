"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import {
  type MentorContent,
  type MentorContentField,
  usePhotoEditContext,
} from "@/lib/photo-edit-context";

type Fallbacks = Required<MentorContent>;

type Props = {
  mentorId: string;
  mentorName: string;
  fallbacks: Fallbacks;
  onClose: () => void;
};

type FieldDef = {
  key: MentorContentField;
  label: string;
  hint?: string;
  rows: number;
};

const FIELDS: FieldDef[] = [
  {
    key: "message",
    label: "Quote / pesan",
    hint: "Akan ditampilkan dalam huruf miring di atas bio.",
    rows: 4,
  },
  {
    key: "achievement",
    label: "Pencapaian",
    rows: 3,
  },
  {
    key: "currentStudies",
    label: "Studi saat ini",
    rows: 2,
  },
  { key: "s1", label: "Pendidikan S1", rows: 2 },
  {
    key: "scholarship",
    label: "Beasiswa & penghargaan",
    hint: "Pisahkan tiap baris dengan Enter.",
    rows: 5,
  },
];

/**
 * Admin-only panel for editing the bio modal's text content for one mentor.
 * Mirrors the PhotoEditPanel pattern: portal-rendered, fixed position,
 * writes to the existing PhotoEditContext draft store, ships via the
 * shared Publish button.
 */
export default function MentorContentEditPanel({
  mentorId,
  mentorName,
  fallbacks,
  onClose,
}: Props) {
  const ctx = usePhotoEditContext();
  const live = ctx?.getContent(mentorId, fallbacks).values ?? fallbacks;
  const [values, setValues] = useState<Fallbacks>(live);
  const initialRef = useRef<Fallbacks>(live);

  // Drag-to-move state. When `pos` is null the panel sits at its default
  // bottom-center anchor; once the admin drags it the panel pins to the
  // dropped coordinate so the bio modal preview behind it stays visible.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Register panel-open with the context so carousels pause.
  useEffect(() => {
    ctx?.registerPanel(true);
    return () => ctx?.registerPanel(false);
  }, [ctx]);

  // Push every keystroke into a local draft so the modal updates live.
  useEffect(() => {
    if (!ctx) return;
    const patch: MentorContent = {};
    let touched = false;
    for (const f of FIELDS) {
      if (values[f.key] !== initialRef.current[f.key]) {
        patch[f.key] = values[f.key];
        touched = true;
      }
    }
    if (touched) ctx.setContentDraft(mentorId, patch);
  }, [values, ctx, mentorId]);

  // Drag handlers — bound on header mousedown, listen on window so the user
  // can move outside the small grab area without losing the drag.
  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Don't hijack the close-button click.
    if ((e.target as HTMLElement).closest("button")) return;
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));
    const onMove = (e: PointerEvent) => {
      const w = panelRef.current?.offsetWidth ?? 420;
      const h = panelRef.current?.offsetHeight ?? 200;
      const minVisible = 56;
      setPos({
        x: clamp(
          e.clientX - dragOffsetRef.current.x,
          minVisible - w,
          window.innerWidth - minVisible,
        ),
        y: clamp(
          e.clientY - dragOffsetRef.current.y,
          0,
          window.innerHeight - minVisible,
        ),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  if (typeof document === "undefined") return null;

  const reset = () => {
    setValues(fallbacks);
    ctx?.clearContentDraft(mentorId);
  };

  const baseStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { left: "50%", bottom: "6rem", transform: "translateX(-50%)" };

  return createPortal(
    <div
      ref={panelRef}
      className={`force-light fixed z-[110] w-[min(92vw,420px)] max-h-[78vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-border text-foreground ${
        dragging ? "select-none" : ""
      }`}
      style={baseStyle}
      role="dialog"
      aria-label={`Edit konten untuk ${mentorName}`}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        className={`sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-white ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        title="Drag to move"
      >
        <div className="min-w-0 flex items-center gap-2">
          <Icon name="edit" size={12} className="text-text-muted-2 -ml-1" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted-2">
              Edit content · drag to move
            </p>
            <h3 className="font-bold text-sm truncate">{mentorName}</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="p-1.5 rounded-md hover:bg-primary-50 text-text-muted hover:text-foreground transition"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="block text-xs font-semibold text-foreground mb-1">
              {f.label}
            </span>
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              rows={f.rows}
              className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
            />
            {f.hint && (
              <span className="block mt-1 text-[10px] text-text-muted">
                {f.hint}
              </span>
            )}
          </label>
        ))}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs font-semibold text-text-muted hover:text-foreground transition"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary-600 transition"
          >
            Done
          </button>
        </div>

        <p className="text-[10px] text-text-muted-2 leading-relaxed">
          Perubahan tersimpan sebagai draft di browser ini. Klik tombol{" "}
          <span className="font-semibold">Publish</span> di pojok kanan bawah
          untuk mengirimkan ke server.
        </p>
      </div>
    </div>,
    document.body,
  );
}
