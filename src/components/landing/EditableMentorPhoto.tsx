"use client";

import { useState } from "react";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { type PhotoLocation, objectPositionPercent } from "@/lib/photo-config";
import { usePhotoConfig, usePhotoEditContext } from "@/lib/photo-edit-context";
import PhotoEditPanel from "./PhotoEditPanel";

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
}: Props) {
  const cfg = usePhotoConfig(mentorId, location, fallbackPhoto);
  const ctx = usePhotoEditContext();
  const [panelOpen, setPanelOpen] = useState(false);

  const showAffordance = ctx?.isAdmin && ctx.editing;

  const style: React.CSSProperties = {
    objectPosition: `${objectPositionPercent(cfg.posX)}% ${objectPositionPercent(cfg.posY)}%`,
    transform: cfg.zoom !== 1 ? `scale(${cfg.zoom})` : undefined,
    transformOrigin: "center",
  };

  return (
    <>
      <Image
        src={cfg.photoSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={imgClassName}
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
    </>
  );
}
