"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import {
  type PhotoConfig,
  type PhotoLocation,
  objectPositionPercent,
} from "@/lib/photo-config";
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

  if (!ctx) return null;

  const handleReset = () => {
    ctx.clearDraft(mentorId, location);
    onClose();
  };

  const previewStyle: React.CSSProperties = {
    objectFit: "cover",
    objectPosition: `${objectPositionPercent(posX)}% ${objectPositionPercent(posY)}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: "center",
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Photo editor"
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview pane */}
        <div className="relative bg-primary-50 aspect-[4/5] md:aspect-auto md:min-h-[480px] overflow-hidden">
          <Image
            key={photoSrc}
            src={photoSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            className=""
            style={previewStyle}
          />
        </div>

        {/* Controls */}
        <div className="p-5 sm:p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted mb-1">
              {LOCATION_LABELS[location]}
            </p>
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-primary-900">
              {mentor?.fullName ?? mentorId}
            </h3>
          </div>

          {/* File picker */}
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

          {/* Zoom */}
          <Slider
            label="Zoom"
            value={zoom}
            min={1}
            max={2.5}
            step={0.05}
            displayValue={`${zoom.toFixed(2)}×`}
            onChange={setZoom}
          />

          {/* Pan X */}
          <Slider
            label="Position X"
            value={posX}
            min={-100}
            max={100}
            step={1}
            displayValue={`${posX > 0 ? "+" : ""}${posX}`}
            onChange={setPosX}
          />

          {/* Pan Y */}
          <Slider
            label="Position Y"
            value={posY}
            min={-100}
            max={100}
            step={1}
            displayValue={`${posY > 0 ? "+" : ""}${posY}`}
            onChange={setPosY}
          />

          <div className="flex items-center gap-2 pt-2 mt-auto">
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
          <p className="text-[11px] text-text-muted-2 leading-relaxed">
            Changes live in your browser as drafts. Use the <strong>Publish</strong> button in the
            top toolbar to save them server-side so all visitors see them.
          </p>
        </div>
      </div>
    </div>
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
