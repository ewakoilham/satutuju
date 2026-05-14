"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { usePhotoEditContext } from "@/lib/photo-edit-context";
import MentorNicknameSettings from "./MentorNicknameSettings";

const POSITION_KEY = "satutuju.photo-edit-toolbar.position";
const HIDDEN_KEY = "satutuju.photo-edit-toolbar.hidden";

/**
 * Floating admin toolbar — only rendered when the user has role=admin.
 * Lets them toggle inline photo editing and publish their localStorage drafts.
 *
 * Drag the grip on the left to relocate the toolbar; click the × to collapse
 * to a small "Admin tools" pill in the corner. Position + hidden state persist
 * to localStorage between reloads.
 */
export default function PhotoEditToolbar() {
  const ctx = usePhotoEditContext();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nicknameSettingsOpen, setNicknameSettingsOpen] = useState(false);

  // Drag offset from the bottom-right anchor. Negative values move the
  // toolbar up / left from its default position.
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount. Sanity-check the saved position so
  // an old offset from a larger monitor doesn't strand the toolbar offscreen.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const px = parsed?.x;
        const py = parsed?.y;
        if (typeof px === "number" && typeof py === "number") {
          const onScreen =
            px <= 100 &&
            px >= -(window.innerWidth - 100) &&
            py <= 100 &&
            py >= -(window.innerHeight - 100);
          if (onScreen) setPosition({ x: px, y: py });
        }
      }
      setHidden(localStorage.getItem(HIDDEN_KEY) === "1");
    } catch {
      /* ignore corrupt localStorage */
    }
    setHydrated(true);
  }, []);

  // Persist only after a drag finishes (or on first hydration). Avoids
  // thrashing localStorage with one setItem per pointer-move pixel.
  useEffect(() => {
    if (!hydrated || dragging) return;
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch {
      /* ignore */
    }
  }, [position, hydrated, dragging]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hidden, hydrated]);

  // Global pointer listeners — keep dragging smooth even when the cursor
  // briefly leaves the toolbar bounds.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragRef.current;
      if (!ds) return;
      setPosition({
        x: ds.origX + (e.clientX - ds.startX),
        y: ds.origY + (e.clientY - ds.startY),
      });
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

  if (!ctx || !ctx.isAdmin) return null;

  const startDrag = (e: React.PointerEvent) => {
    // Don't initiate drag from interactive children — buttons & links should
    // remain clickable.
    if ((e.target as HTMLElement).closest("button, a, input, select, label")) {
      return;
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    setDragging(true);
    e.preventDefault();
  };

  const handlePublish = async () => {
    setBusy(true);
    setMsg(null);
    const result = await ctx.publish();
    setBusy(false);
    setMsg(
      result.ok
        ? `Published ${result.saved} change${result.saved === 1 ? "" : "s"} ✓`
        : `Publish failed: ${result.error ?? "unknown error"}`,
    );
    setTimeout(() => setMsg(null), 3500);
  };

  // Collapsed state — small pill in the corner. Always anchored to the
  // default position (no drag translate) so it's discoverable even when the
  // saved offset is stale.
  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label="Show admin toolbar"
        title="Show admin toolbar"
        className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary-900/90 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-white/10 hover:bg-primary-900 transition"
      >
        <Icon name="edit" size={12} />
        Admin tools
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        userSelect: dragging ? "none" : undefined,
      }}
    >
      {msg && (
        <div className="px-3 py-2 rounded-lg bg-primary-900 text-white text-xs font-semibold shadow-lg">
          {msg}
        </div>
      )}
      <div
        className={`flex items-center gap-1 pl-1 pr-1.5 py-1.5 rounded-full bg-primary-900/95 backdrop-blur-md text-white shadow-2xl border border-white/10 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={startDrag}
        title="Drag to move"
      >
        {/* Drag grip */}
        <span
          aria-hidden
          className="grid place-items-center w-7 h-7 text-white/45 select-none"
        >
          <Icon name="menu" size={12} />
        </span>

        <button
          type="button"
          onClick={() => ctx.setEditing(!ctx.editing)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition ${
            ctx.editing
              ? "bg-brand-yellow text-primary-900"
              : "bg-white/10 hover:bg-white/20 text-white"
          }`}
        >
          <Icon name="edit" size={14} />
          {ctx.editing ? "Editing" : "Edit mode"}
        </button>

        <button
          type="button"
          onClick={() => setNicknameSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
        >
          <Icon name="user" size={14} />
          Nicknames
        </button>

        <Link
          href="/dashboard/admin/mentors"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
        >
          <Icon name="users" size={14} />
          Mentors
        </Link>

        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || ctx.draftCount === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-primary text-white hover:bg-primary-600 transition disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed"
        >
          <Icon name="upload" size={14} />
          {busy ? "Publishing…" : ctx.draftCount > 0 ? `Publish (${ctx.draftCount})` : "Publish"}
        </button>

        {/* Hide button — collapses to the "Admin tools" pill */}
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide toolbar"
          title="Hide toolbar"
          className="grid place-items-center w-7 h-7 ml-0.5 rounded-full text-white/55 hover:text-white hover:bg-white/10 transition"
        >
          <Icon name="x" size={12} />
        </button>
      </div>

      {nicknameSettingsOpen && (
        <MentorNicknameSettings onClose={() => setNicknameSettingsOpen(false)} />
      )}
    </div>
  );
}
