"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { usePhotoEditContext } from "@/lib/photo-edit-context";
import MentorNicknameSettings from "./MentorNicknameSettings";

/**
 * Floating admin toolbar — only rendered when the user has role=admin.
 * Lets them toggle inline photo editing and publish their localStorage drafts.
 */
export default function PhotoEditToolbar() {
  const ctx = usePhotoEditContext();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nicknameSettingsOpen, setNicknameSettingsOpen] = useState(false);

  if (!ctx || !ctx.isAdmin) return null;

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

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      {msg && (
        <div className="px-3 py-2 rounded-lg bg-primary-900 text-white text-xs font-semibold shadow-lg">
          {msg}
        </div>
      )}
      <div className="flex items-center gap-2 px-2 py-2 rounded-full bg-primary-900/95 backdrop-blur-md text-white shadow-2xl border border-white/10">
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
          {ctx.editing ? "Editing" : "Edit photos"}
        </button>

        <button
          type="button"
          onClick={() => setNicknameSettingsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
        >
          <Icon name="user" size={14} />
          Nicknames
        </button>

        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || ctx.draftCount === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-primary text-white hover:bg-primary-600 transition disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed"
        >
          <Icon name="upload" size={14} />
          {busy ? "Publishing…" : ctx.draftCount > 0 ? `Publish (${ctx.draftCount})` : "Publish"}
        </button>
      </div>

      {nicknameSettingsOpen && (
        <MentorNicknameSettings onClose={() => setNicknameSettingsOpen(false)} />
      )}
    </div>
  );
}
