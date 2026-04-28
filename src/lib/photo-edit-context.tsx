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
  /** True while an edit panel is currently open (used by carousels to
   *  pause auto-advance so the photo the admin is editing stays visible). */
  panelOpen: boolean;
  /** Increment when an edit panel mounts; decrement on unmount. */
  registerPanel: (open: boolean) => void;
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
  // ── Mentor nickname overrides ─────────────────────────────────────────
  /** Resolve a mentor's nickname (admin draft → server override → default). */
  getNickname: (mentorId: string, fallback: string) => { value: string; isDraft: boolean };
  /** Stage a nickname change as a local draft. */
  setNicknameDraft: (mentorId: string, value: string) => void;
  /** Drop a nickname draft (revert to server/default). */
  clearNicknameDraft: (mentorId: string) => void;
};

const PhotoEditContext = createContext<Ctx | null>(null);

// ── Nickname draft helpers (separate localStorage key) ──────────────────────

const NICK_LS_KEY = "satutuju-nickname-drafts";

function readNickDrafts(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NICK_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeNickDrafts(d: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NICK_LS_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function PhotoEditProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState<ServerMap>({});
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [openPanels, setOpenPanels] = useState(0);
  const [serverNicknames, setServerNicknames] = useState<Record<string, string>>({});
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});

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
    setNicknameDrafts(readNickDrafts());
  }, []);

  // Load server nickname overrides.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentor-overrides")
      .then((r) => (r.ok ? r.json() : { overrides: [] }))
      .then((data: { overrides: Array<{ mentorId: string; nickname: string | null }> }) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const row of data.overrides ?? []) {
          if (row.nickname) map[row.mentorId] = row.nickname;
        }
        setServerNicknames(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    const photoEntries = Object.entries(drafts);
    const nickEntries = Object.entries(nicknameDrafts);
    if (photoEntries.length === 0 && nickEntries.length === 0) return { ok: true, saved: 0 };

    try {
      // Photo configs
      if (photoEntries.length > 0) {
        const payload = photoEntries.map(([k, cfg]) => {
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
        setServer((prev) => {
          const next = { ...prev };
          for (const [k, cfg] of photoEntries) next[k as PhotoConfigKey] = cfg;
          return next;
        });
        setDrafts({});
        clearDrafts();
      }

      // Nickname overrides
      if (nickEntries.length > 0) {
        const payload = nickEntries.map(([mentorId, nickname]) => ({ mentorId, nickname }));
        const res = await fetch("/api/mentor-overrides", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: payload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, saved: 0, error: (data as { error?: string }).error ?? `HTTP ${res.status}` };
        }
        setServerNicknames((prev) => {
          const next = { ...prev };
          for (const [id, name] of nickEntries) next[id] = name;
          return next;
        });
        setNicknameDrafts({});
        writeNickDrafts({});
      }

      return { ok: true, saved: photoEntries.length + nickEntries.length };
    } catch (e) {
      return { ok: false, saved: 0, error: e instanceof Error ? e.message : "Publish failed" };
    }
  }, [drafts, nicknameDrafts]);

  const draftCount = useMemo(
    () => Object.keys(drafts).length + Object.keys(nicknameDrafts).length,
    [drafts, nicknameDrafts],
  );

  const getNickname = useCallback(
    (mentorId: string, fallback: string) => {
      const draft = nicknameDrafts[mentorId];
      if (draft !== undefined) return { value: draft, isDraft: true };
      const srv = serverNicknames[mentorId];
      if (srv) return { value: srv, isDraft: false };
      return { value: fallback, isDraft: false };
    },
    [nicknameDrafts, serverNicknames],
  );

  const setNicknameDraft = useCallback((mentorId: string, value: string) => {
    setNicknameDrafts((prev) => {
      const updated = { ...prev, [mentorId]: value };
      writeNickDrafts(updated);
      return updated;
    });
  }, []);

  const clearNicknameDraft = useCallback((mentorId: string) => {
    setNicknameDrafts((prev) => {
      if (!(mentorId in prev)) return prev;
      const updated = { ...prev };
      delete updated[mentorId];
      writeNickDrafts(updated);
      return updated;
    });
  }, []);

  const registerPanel = useCallback((open: boolean) => {
    setOpenPanels((n) => Math.max(0, n + (open ? 1 : -1)));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      isAdmin,
      editing,
      setEditing,
      panelOpen: openPanels > 0,
      registerPanel,
      loaded,
      get,
      setDraft,
      clearDraft,
      draftCount,
      publish,
      getNickname,
      setNicknameDraft,
      clearNicknameDraft,
    }),
    [
      isAdmin,
      editing,
      openPanels,
      registerPanel,
      loaded,
      get,
      setDraft,
      clearDraft,
      draftCount,
      publish,
      getNickname,
      setNicknameDraft,
      clearNicknameDraft,
    ],
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

/** Returns true while any photo edit panel is currently mounted. */
export function useEditPanelOpen(): boolean {
  return useContext(PhotoEditContext)?.panelOpen ?? false;
}

/** Resolve a mentor's nickname (admin draft → server override → default). */
export function useMentorNickname(mentorId: string, fallback: string): string {
  const ctx = useContext(PhotoEditContext);
  if (!ctx) return fallback;
  return ctx.getNickname(mentorId, fallback).value;
}

/** Full context for editor controls (admin status, edit mode, publish, drafts). */
export function usePhotoEditContext(): Ctx | null {
  return useContext(PhotoEditContext);
}
