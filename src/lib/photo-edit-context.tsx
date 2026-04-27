"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type DraftMap,
  type PhotoConfig,
  type PhotoConfigKey,
  type PhotoLocation,
  clearDrafts,
  configKey,
  readDrafts,
  resolveConfig,
  writeDrafts,
} from "./photo-config";

type ServerMap = Partial<Record<PhotoConfigKey, PhotoConfig>>;

type Ctx = {
  /** True if the current user is an admin (JWT role === "admin"). */
  isAdmin: boolean;
  /** True when the admin has toggled the inline photo editor on. */
  editing: boolean;
  setEditing: (next: boolean) => void;
  /** True after the published config has been fetched at least once. */
  loaded: boolean;
  /** Get the current effective config for a mentor at a location. */
  get: (
    mentorId: string,
    location: PhotoLocation,
    fallbackPhoto: string,
  ) => PhotoConfig & { isDraft: boolean };
  /** Update a draft (localStorage-backed); show preview immediately. */
  setDraft: (mentorId: string, location: PhotoLocation, next: PhotoConfig) => void;
  /** Drop the local draft for a single key (revert to server / default). */
  clearDraft: (mentorId: string, location: PhotoLocation) => void;
  /** How many drafts are currently waiting to be published. */
  draftCount: number;
  /** Ship all local drafts to the server. */
  publish: () => Promise<{ ok: boolean; saved: number; error?: string }>;
};

const PhotoEditContext = createContext<Ctx | null>(null);

export function PhotoEditProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState<ServerMap>({});
  const [drafts, setDrafts] = useState<DraftMap>({});

  // Detect admin via /api/auth/me — fail-open as non-admin.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.user?.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load published configs from API.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/landing-photos")
      .then((r) => (r.ok ? r.json() : { configs: [] }))
      .then((data: { configs: Array<PhotoConfig & { mentorId: string; location: PhotoLocation }> }) => {
        if (cancelled) return;
        const map: ServerMap = {};
        for (const row of data.configs ?? []) {
          map[configKey(row.mentorId, row.location)] = {
            photoSrc: row.photoSrc,
            zoom: row.zoom,
            posX: row.posX,
            posY: row.posY,
          };
        }
        setServer(map);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load any pending drafts from localStorage on mount.
  useEffect(() => {
    setDrafts(readDrafts());
  }, []);

  const get = useCallback(
    (mentorId: string, location: PhotoLocation, fallbackPhoto: string) => {
      const k = configKey(mentorId, location);
      const draft = drafts[k];
      const srv = server[k];
      const cfg = resolveConfig(srv, draft, fallbackPhoto);
      return { ...cfg, isDraft: Boolean(draft) };
    },
    [drafts, server],
  );

  const setDraft = useCallback(
    (mentorId: string, location: PhotoLocation, next: PhotoConfig) => {
      setDrafts((prev) => {
        const k = configKey(mentorId, location);
        const updated = { ...prev, [k]: next };
        writeDrafts(updated);
        return updated;
      });
    },
    [],
  );

  const clearDraft = useCallback((mentorId: string, location: PhotoLocation) => {
    setDrafts((prev) => {
      const k = configKey(mentorId, location);
      if (!(k in prev)) return prev;
      const updated = { ...prev };
      delete updated[k];
      writeDrafts(updated);
      return updated;
    });
  }, []);

  const publish = useCallback(async () => {
    const entries = Object.entries(drafts);
    if (entries.length === 0) return { ok: true, saved: 0 };
    try {
      const payload = entries.map(([k, cfg]) => {
        const [mentorId, location] = k.split(":") as [string, PhotoLocation];
        return { mentorId, location, ...cfg };
      });
      const res = await fetch("/api/landing-photos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, saved: 0, error: (data as { error?: string }).error ?? `HTTP ${res.status}` };
      }
      // Move drafts → server map, clear local store.
      setServer((prev) => {
        const next = { ...prev };
        for (const [k, cfg] of entries) next[k as PhotoConfigKey] = cfg;
        return next;
      });
      setDrafts({});
      clearDrafts();
      return { ok: true, saved: entries.length };
    } catch (e) {
      return { ok: false, saved: 0, error: e instanceof Error ? e.message : "Publish failed" };
    }
  }, [drafts]);

  const draftCount = useMemo(() => Object.keys(drafts).length, [drafts]);

  const value = useMemo<Ctx>(
    () => ({
      isAdmin,
      editing,
      setEditing,
      loaded,
      get,
      setDraft,
      clearDraft,
      draftCount,
      publish,
    }),
    [isAdmin, editing, loaded, get, setDraft, clearDraft, draftCount, publish],
  );

  return <PhotoEditContext.Provider value={value}>{children}</PhotoEditContext.Provider>;
}

/** Returns the live config for a mentor at a location (with draft awareness). */
export function usePhotoConfig(mentorId: string, location: PhotoLocation, fallbackPhoto: string) {
  const ctx = useContext(PhotoEditContext);
  if (!ctx) {
    return { photoSrc: fallbackPhoto, zoom: 1, posX: 0, posY: 0, isDraft: false };
  }
  return ctx.get(mentorId, location, fallbackPhoto);
}

/** Full context for editor controls (admin status, edit mode, publish, drafts). */
export function usePhotoEditContext(): Ctx | null {
  return useContext(PhotoEditContext);
}
