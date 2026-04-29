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
import { MENTORS } from "./mentors";
import {
  type DbMentor,
  type MergedMentor,
  mergeMentorLists,
} from "./mentors-runtime";

type ServerMap = Partial<Record<PhotoConfigKey, PhotoConfig>>;

// ── Bio content overrides ──────────────────────────────────────────────────
//
// Editable text fields shown inside the bio modal. Each field falls back to
// the static value in mentors.json when no override exists. Admin-only.
export type MentorContentField =
  | "message"
  | "achievement"
  | "currentStudies"
  | "s1"
  | "scholarship";

export type MentorContent = Partial<Record<MentorContentField, string | null>>;

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
  // ── Mentor bio content overrides (admin only) ─────────────────────────
  /** Resolve a mentor's bio fields (draft → server → fallbacks from JSON). */
  getContent: (
    mentorId: string,
    fallbacks: Required<MentorContent>,
  ) => { values: Required<MentorContent>; isDraft: boolean };
  /** Stage a partial content change for a mentor. Pass null to clear a field. */
  setContentDraft: (mentorId: string, patch: MentorContent) => void;
  /** Drop the entire content draft for one mentor. */
  clearContentDraft: (mentorId: string) => void;
  // ── Live mentor list (static + DB) ─────────────────────────────────────
  /** Merged list of MENTORS (static seed) + admin-added mentors from DB. */
  mentors: MergedMentor[];
  /** Force a refetch of the DB mentor list (after admin add/edit/delete). */
  refreshMentors: () => Promise<void>;
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

// ── Bio content draft helpers ──────────────────────────────────────────────

const CONTENT_LS_KEY = "satutuju-content-drafts";

function readContentDrafts(): Record<string, MentorContent> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONTENT_LS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MentorContent>) : {};
  } catch {
    return {};
  }
}

function writeContentDrafts(d: Record<string, MentorContent>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONTENT_LS_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

const CONTENT_FIELDS: MentorContentField[] = [
  "message",
  "achievement",
  "currentStudies",
  "s1",
  "scholarship",
];

export function PhotoEditProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [server, setServer] = useState<ServerMap>({});
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [openPanels, setOpenPanels] = useState(0);
  const [serverNicknames, setServerNicknames] = useState<Record<string, string>>({});
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
  const [serverContent, setServerContent] = useState<Record<string, MentorContent>>({});
  const [contentDrafts, setContentDrafts] = useState<Record<string, MentorContent>>({});
  const [dbMentors, setDbMentors] = useState<DbMentor[]>([]);

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
    setContentDrafts(readContentDrafts());
  }, []);

  // Pull admin-added mentors from the API and keep refreshable for the admin
  // panel (so newly-added mentors appear on the landing page immediately).
  const refreshMentors = useCallback(async () => {
    try {
      const res = await fetch("/api/mentors");
      if (!res.ok) return;
      const data = (await res.json()) as { mentors: DbMentor[] };
      setDbMentors(data.mentors ?? []);
    } catch {
      /* network blip — keep prior list */
    }
  }, []);

  useEffect(() => {
    void refreshMentors();
  }, [refreshMentors]);

  // Load server overrides (nickname + bio content in the same call).
  useEffect(() => {
    let cancelled = false;
    type OverrideRow = {
      mentorId: string;
      nickname?: string | null;
    } & MentorContent;
    fetch("/api/mentor-overrides")
      .then((r) => (r.ok ? r.json() : { overrides: [] }))
      .then((data: { overrides: OverrideRow[] }) => {
        if (cancelled) return;
        const nickMap: Record<string, string> = {};
        const contentMap: Record<string, MentorContent> = {};
        for (const row of data.overrides ?? []) {
          if (row.nickname) nickMap[row.mentorId] = row.nickname;
          const content: MentorContent = {};
          let hasContent = false;
          for (const f of CONTENT_FIELDS) {
            const v = row[f];
            if (v !== undefined && v !== null && v !== "") {
              content[f] = v;
              hasContent = true;
            }
          }
          if (hasContent) contentMap[row.mentorId] = content;
        }
        setServerNicknames(nickMap);
        setServerContent(contentMap);
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
    const contentEntries = Object.entries(contentDrafts);
    if (
      photoEntries.length === 0 &&
      nickEntries.length === 0 &&
      contentEntries.length === 0
    ) {
      return { ok: true, saved: 0 };
    }

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

      // Nickname + bio content overrides — share the /api/mentor-overrides endpoint.
      // Merge per mentor so a single upsert carries both nickname and any
      // touched content fields.
      const overrideMap = new Map<string, Row>();
      type Row = {
        mentorId: string;
        nickname?: string | null;
      } & MentorContent;
      for (const [mentorId, nickname] of nickEntries) {
        overrideMap.set(mentorId, { mentorId, nickname });
      }
      for (const [mentorId, content] of contentEntries) {
        const existing = overrideMap.get(mentorId) ?? { mentorId };
        overrideMap.set(mentorId, { ...existing, ...content });
      }

      if (overrideMap.size > 0) {
        const payload = Array.from(overrideMap.values());
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
        if (nickEntries.length > 0) {
          setServerNicknames((prev) => {
            const next = { ...prev };
            for (const [id, name] of nickEntries) next[id] = name;
            return next;
          });
          setNicknameDrafts({});
          writeNickDrafts({});
        }
        if (contentEntries.length > 0) {
          setServerContent((prev) => {
            const next = { ...prev };
            for (const [id, content] of contentEntries) {
              next[id] = { ...(next[id] ?? {}), ...content };
            }
            return next;
          });
          setContentDrafts({});
          writeContentDrafts({});
        }
      }

      return {
        ok: true,
        saved: photoEntries.length + nickEntries.length + contentEntries.length,
      };
    } catch (e) {
      return { ok: false, saved: 0, error: e instanceof Error ? e.message : "Publish failed" };
    }
  }, [drafts, nicknameDrafts, contentDrafts]);

  const draftCount = useMemo(
    () =>
      Object.keys(drafts).length +
      Object.keys(nicknameDrafts).length +
      Object.keys(contentDrafts).length,
    [drafts, nicknameDrafts, contentDrafts],
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

  const getContent = useCallback(
    (mentorId: string, fallbacks: Required<MentorContent>) => {
      const draft = contentDrafts[mentorId];
      const srv = serverContent[mentorId];
      const out = { ...fallbacks } as Required<MentorContent>;
      // server overrides JSON; drafts override server.
      if (srv) {
        for (const f of CONTENT_FIELDS) {
          const v = srv[f];
          if (v !== undefined && v !== null && v !== "") out[f] = v;
        }
      }
      if (draft) {
        for (const f of CONTENT_FIELDS) {
          // Draft can explicitly clear a field by setting it to "" — treat as
          // "use the fallback" to avoid leaving the modal with empty bio text.
          const v = draft[f];
          if (v !== undefined) out[f] = v ?? fallbacks[f];
        }
      }
      return { values: out, isDraft: Boolean(draft) };
    },
    [contentDrafts, serverContent],
  );

  const setContentDraft = useCallback((mentorId: string, patch: MentorContent) => {
    setContentDrafts((prev) => {
      const next = { ...prev, [mentorId]: { ...(prev[mentorId] ?? {}), ...patch } };
      writeContentDrafts(next);
      return next;
    });
  }, []);

  const clearContentDraft = useCallback((mentorId: string) => {
    setContentDrafts((prev) => {
      if (!(mentorId in prev)) return prev;
      const next = { ...prev };
      delete next[mentorId];
      writeContentDrafts(next);
      return next;
    });
  }, []);

  const registerPanel = useCallback((open: boolean) => {
    setOpenPanels((n) => Math.max(0, n + (open ? 1 : -1)));
  }, []);

  const mentors = useMemo<MergedMentor[]>(
    () => mergeMentorLists(MENTORS, dbMentors),
    [dbMentors],
  );

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
      getContent,
      setContentDraft,
      clearContentDraft,
      mentors,
      refreshMentors,
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
      getContent,
      setContentDraft,
      clearContentDraft,
      mentors,
      refreshMentors,
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

/** Resolve a mentor's bio content fields with overrides applied. */
export function useMentorContent(
  mentorId: string,
  fallbacks: Required<MentorContent>,
): { values: Required<MentorContent>; isDraft: boolean } {
  const ctx = useContext(PhotoEditContext);
  if (!ctx) return { values: fallbacks, isDraft: false };
  return ctx.getContent(mentorId, fallbacks);
}

/**
 * Live mentor list for landing-page consumers (Hero, Marquee, BioModal).
 * Falls back to the static MENTORS seed when the provider isn't mounted
 * (e.g. for components rendered outside the landing page).
 */
export function useAllMentors(): MergedMentor[] {
  const ctx = useContext(PhotoEditContext);
  if (ctx) return ctx.mentors;
  // Out-of-provider fallback: just the static seed, marked as "static".
  return MENTORS.map((m) => ({ ...m, dbSource: "static" as const }));
}

/** Full context for editor controls (admin status, edit mode, publish, drafts). */
export function usePhotoEditContext(): Ctx | null {
  return useContext(PhotoEditContext);
}
