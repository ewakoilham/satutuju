"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { type PhotoConfig, type PhotoLocation } from "@/lib/photo-config";
import { usePhotoConfig, usePhotoEditContext } from "@/lib/photo-edit-context";
import { MENTORS, getMentorPhotos } from "@/lib/mentors";

const LOCATION_LABELS: Record<PhotoLocation, string> = {
  "hero-featured": "Hero featured card",
  "hero-mobile": "Hero mobile compact card",
  "hero-avatar": "Hero avatar strip",
  "marquee-card": "Mentor showcase card",
  "bio-modal": "Bio modal",
};

type Props = {
  mentorId: string;
  location: PhotoLocation;
  fallbackPhoto: string;
  onClose: () => void;
};

export default function PhotoEditPanel({ mentorId, location, fallbackPhoto, onClose }: Props) {
  const ctx = usePhotoEditContext();
  const live = usePhotoConfig(mentorId, location, fallbackPhoto);
  const [photoSrc, setPhotoSrc] = useState(live.photoSrc);
  const [zoom, setZoom] = useState(live.zoom);
  const [posX, setPosX] = useState(live.posX);
  const [posY, setPosY] = useState(live.posY);

  // Build the file dropdown for this mentor: avatar (Mentor.photo) + gallery.
  const mentor = MENTORS.find((m) => m.id === mentorId);
  const availablePhotos = (() => {
    const result: { src: string; label: string }[] = [];
    if (mentor?.photo) result.push({ src: mentor.photo, label: "Avatar (default)" });
    const gallery = getMentorPhotos(mentorId);
    gallery.forEach((src, i) => result.push({ src, label: `Gallery ${i + 1}` }));
    return result;
  })();

  // Apply changes live as the admin drags sliders.
  useEffect(() => {
    if (!ctx) return;
    const cfg: PhotoConfig = { photoSrc, zoom, posX, posY };
    ctx.setDraft(mentorId, location, cfg);
  }, [photoSrc, zoom, posX, posY, mentorId, location, ctx]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Register / unregister this panel so carousels know to pause auto-advance.
  useEffect(() => {
    if (!ctx) return;
    ctx.registerPanel(true);
    return () => ctx.registerPanel(false);
  }, [ctx]);

  // Drag-to-move state — initial position is centered above the toolbar; admin
  // can drag the header to relocate the panel anywhere over the page.
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      setDrag({ x: ds.origX + (e.clientX - ds.startX), y: ds.origY + (e.clientY - ds.startY) });
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDragging(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    // Don't initiate drag from interactive elements (close button, etc.).
    if ((e.target as HTMLElement).closest("button, input, select, label, a")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: drag.x,
      origY: drag.y,
    };
    setDragging(true);
    e.preventDefault();
  };

  if (!ctx) return null;

  const handleReset = () => {
    ctx.clearDraft(mentorId, location);
    onClose();
  };

  // Render via portal so the panel escapes any clipping / containing-block
  // from its parent (e.g., overflow-hidden on the avatar buttons).
  if (typeof document === "undefined") return null;

  return createPortal(
    (<div
      // Floating, non-modal: sits above content but doesn't dim or block the
      // page so the admin can see live photo updates while dragging sliders.
      // `force-light` keeps text/border tokens readable when the user's
      // theme is dark — the portal escapes the landing-page wrapper.
      role="dialog"
      aria-label="Photo editor"
      className="force-light fixed left-1/2 bottom-24 z-[90] w-[min(92vw,360px)] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-border text-foreground"
      style={{
        transform: `translate(calc(-50% + ${drag.x}px), ${drag.y}px)`,
        userSelect: dragging ? "none" : undefined,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 flex flex-col gap-4">
        <div
          className={`flex items-start justify-between gap-3 -m-1 p-1 rounded-lg ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={startDrag}
          title="Drag to move"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted mb-1 inline-flex items-center gap-1.5">
              <Icon name="menu" size={10} className="opacity-60" />
              {LOCATION_LABELS[location]}
            </p>
            <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-primary-900 leading-tight">
              {mentor?.fullName ?? mentorId}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-elevated transition shrink-0 cursor-pointer"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <Field label="Photo">
          {availablePhotos.length > 0 ? (
            <select
              value={photoSrc}
              onChange={(e) => setPhotoSrc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {availablePhotos.map((p) => (
                <option key={p.src} value={p.src}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-text-muted">No photos available</p>
          )}
        </Field>

        <Slider
          label="Zoom"
          value={zoom}
          min={1}
          max={2.5}
          step={0.05}
          displayValue={`${zoom.toFixed(2)}×`}
          onChange={setZoom}
        />

        <Slider
          label="Position X"
          value={posX}
          min={-100}
          max={100}
          step={1}
          displayValue={`${posX > 0 ? "+" : ""}${posX}`}
          onChange={setPosX}
        />

        <Slider
          label="Position Y"
          value={posY}
          min={-100}
          max={100}
          step={1}
          displayValue={`${posY > 0 ? "+" : ""}${posY}`}
          onChange={setPosY}
        />

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-semibold text-text-muted hover:bg-surface-elevated transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-700 transition inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="check" size={14} />
            Done
          </button>
        </div>
      </div>
    </div>),
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-xs font-mono text-text-muted">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
