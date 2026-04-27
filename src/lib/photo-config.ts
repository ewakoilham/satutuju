// Photo configuration system for the editable landing page.
// Server-of-truth: Postgres `LandingPhotoConfig` table (loaded by API).
// Client-side overrides (admin drafts): localStorage.

export type PhotoLocation =
  | "hero-featured"
  | "hero-mobile"
  | "hero-avatar"
  | "marquee-card"
  | "bio-modal";

export const PHOTO_LOCATIONS: PhotoLocation[] = [
  "hero-featured",
  "hero-mobile",
  "hero-avatar",
  "marquee-card",
  "bio-modal",
];

export type PhotoConfig = {
  photoSrc: string;
  zoom: number; // 1.0 .. 2.5
  posX: number; // -100 .. 100 (% offset; 0 = centered)
  posY: number; // -100 .. 100
};

export type PhotoConfigKey = `${string}:${PhotoLocation}`;

export const DEFAULT_TRANSFORM = { zoom: 1, posX: 0, posY: 0 } as const;

export function configKey(mentorId: string, location: PhotoLocation): PhotoConfigKey {
  return `${mentorId}:${location}`;
}

/** Convert symmetric posX (-100..100) to CSS object-position % (0..100). */
export function objectPositionPercent(pos: number): number {
  return 50 + pos / 2;
}

// ── localStorage drafts (per-browser) ───────────────────────────────────────
//
// Single key holds an object: { "mentorId:location": PhotoConfig, ... }

const LS_KEY = "satutuju-photo-drafts";

export type DraftMap = Partial<Record<PhotoConfigKey, PhotoConfig>>;

export function readDrafts(): DraftMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}

export function writeDrafts(drafts: DraftMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(drafts));
  } catch {
    /* quota / disabled — silently ignore */
  }
}

export function clearDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Compose the final config from server + local drafts + defaults. */
export function resolveConfig(
  server: PhotoConfig | undefined,
  draft: PhotoConfig | undefined,
  fallbackPhoto: string,
): PhotoConfig {
  if (draft) return draft;
  if (server) return server;
  return { photoSrc: fallbackPhoto, ...DEFAULT_TRANSFORM };
}
