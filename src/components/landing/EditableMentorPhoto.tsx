"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { type PhotoLocation, objectPositionPercent } from "@/lib/photo-config";
import { usePhotoConfig, usePhotoEditContext } from "@/lib/photo-edit-context";

// Admin-only photo editor — only fetched on first edit-button click, never
// downloaded for regular visitors.
const PhotoEditPanel = dynamic(() => import("./PhotoEditPanel"), {
  ssr: false,
});

type Props = {
  mentorId: string;
  location: PhotoLocation;
  fallbackPhoto: string;
  alt: string;
  /** Pass through to next/image. */
  sizes: string;
  priority?: boolean;
  /** Tailwind classes for the inner <img>. Default: object-cover object-top. */
  imgClassName?: string;
  /**
   * If set, render an enlarged "preview overlay" portal while this photo's
   * edit panel is open. Useful for tiny instances (e.g., the avatar strip)
   * where the in-place change is too small to inspect.
   * Value = pixel size of the preview's longest edge.
   */
  enlargedPreviewSize?: number;
  /**
   * Aspect ratio for the enlarged preview. Default "1/1" (square). For
   * round avatars use "1/1" + roundedFull; for portrait cards use "4/5".
   */
  enlargedPreviewAspect?: string;
  /** Round the enlarged preview (for circular avatars). */
  enlargedPreviewRound?: boolean;
};

/**
 * Wraps an `<Image fill>` with the user-configured photo + transform,
 * and (in admin edit mode) an overlay button that opens the edit panel.
 *
 * The parent container must be `relative` with the desired width/height +
 * `overflow-hidden`, exactly like the existing photo containers.
 */
export default function EditableMentorPhoto({
  mentorId,
  location,
  fallbackPhoto,
  alt,
  sizes,
  priority,
  imgClassName = "object-cover object-top",
  enlargedPreviewSize,
  enlargedPreviewAspect = "1/1",
  enlargedPreviewRound = false,
}: Props) {
  const cfg = usePhotoConfig(mentorId, location, fallbackPhoto);
  const ctx = usePhotoEditContext();
  const [panelOpen, setPanelOpen] = useState(false);

  const showAffordance = ctx?.isAdmin && ctx.editing;

  // Hide the photo until server-stored overrides settle, then latch shown.
  // Prevents the fallback → override swap flicker on first paint without
  // causing fade-out/fade-in on every admin slider drag afterwards.
  const ctxReady = ctx ? ctx.loaded : true;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (ctxReady) setShown(true);
  }, [ctxReady]);

  // object-position handles pan within natural cover-overflow (aspect slack);
  // translate(...) handles pan within zoom-induced overflow. Combining them
  // means the position sliders work regardless of whether slack or zoom is
  // what's creating room to move.
  const tx = -cfg.posX * (cfg.zoom - 1) * 0.5;
  const ty = -cfg.posY * (cfg.zoom - 1) * 0.5;
  const transformParts: string[] = [];
  if (tx !== 0 || ty !== 0) transformParts.push(`translate(${tx}%, ${ty}%)`);
  if (cfg.zoom !== 1) transformParts.push(`scale(${cfg.zoom})`);
  const style: React.CSSProperties = {
    objectPosition: `${objectPositionPercent(cfg.posX)}% ${objectPositionPercent(cfg.posY)}%`,
    transform: transformParts.length > 0 ? transformParts.join(" ") : undefined,
    transformOrigin: "center",
  };

  const showEnlargedPreview =
    panelOpen && enlargedPreviewSize !== undefined && typeof document !== "undefined";

  return (
    <>
      <Image
        src={cfg.photoSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={95}
        className={`${imgClassName} transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        style={style}
      />

      {showAffordance && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setPanelOpen(true);
            }}
            aria-label={`Edit photo for ${alt}`}
            className="absolute top-1.5 right-1.5 z-30 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-[10px] font-semibold shadow-md hover:bg-black/90 transition"
          >
            <Icon name="edit" size={12} />
            Edit
          </button>
          {cfg.isDraft && (
            <span className="absolute top-1.5 left-1.5 z-30 px-1.5 py-0.5 rounded-full bg-brand-yellow text-primary-900 text-[9px] font-bold uppercase tracking-wide shadow">
              Draft
            </span>
          )}
        </>
      )}

      {panelOpen && (
        <PhotoEditPanel
          mentorId={mentorId}
          location={location}
          fallbackPhoto={fallbackPhoto}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {showEnlargedPreview &&
        createPortal(
          <div
            // Top-left corner under the navbar — keeps the centered edit panel
            // unobstructed and the preview in the admin's peripheral view.
            // `force-light` keeps the surrounding chrome on the light tokens
            // even if the user's theme is dark.
            className="force-light fixed top-24 left-6 z-[105] pointer-events-none"
            aria-hidden
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-border p-3 flex flex-col items-center gap-2 text-foreground">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted">
                Live preview
              </p>
              <div
                className={`relative bg-primary-50 overflow-hidden ${
                  enlargedPreviewRound ? "rounded-full" : "rounded-xl"
                }`}
                style={{
                  width: enlargedPreviewSize,
                  aspectRatio: enlargedPreviewAspect,
                }}
              >
                <Image
                  src={cfg.photoSrc}
                  alt=""
                  fill
                  sizes={`${enlargedPreviewSize}px`}
                  quality={95}
                  className={imgClassName}
                  style={style}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
