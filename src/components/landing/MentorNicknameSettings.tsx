"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import { MENTORS } from "@/lib/mentors";
import { usePhotoEditContext } from "@/lib/photo-edit-context";

type Props = { onClose: () => void };

/**
 * Admin-only modal listing every mentor with an editable nickname field.
 * Edits go straight into localStorage drafts; the global Publish button in
 * the toolbar persists them to the server (`MentorOverride` table).
 */
export default function MentorNicknameSettings({ onClose }: Props) {
  const ctx = usePhotoEditContext();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!ctx || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="force-light fixed inset-0 z-[95] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mentor nickname settings"
    >
      <div
        className="w-full max-w-xl max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-border text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-muted mb-1">
              Admin · Nama panggilan mentor
            </p>
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-primary-900 leading-tight">
              Atur nama panggilan setiap mentor
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Nama panggilan ini muncul saat pengunjung hover kartu mentor di carousel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-elevated transition shrink-0"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {MENTORS.map((m) => {
            const resolved = ctx.getNickname(m.id, m.nickname);
            return (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-elevated/60 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary-900 truncate">{m.fullName}</p>
                  <p className="text-[11px] text-text-muted truncate">{m.university}</p>
                </div>
                <input
                  type="text"
                  value={resolved.value}
                  onChange={(e) => ctx.setNicknameDraft(m.id, e.target.value)}
                  placeholder={m.nickname}
                  className={`px-3 py-1.5 rounded-lg border text-sm text-foreground bg-white focus:outline-none focus:border-primary ${
                    resolved.isDraft ? "border-brand-yellow ring-1 ring-brand-yellow/40" : "border-border"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => ctx.clearNicknameDraft(m.id)}
                  disabled={!resolved.isDraft}
                  className="text-[11px] font-semibold text-text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Reset draft"
                >
                  Reset
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-[11px] text-text-muted leading-relaxed">
            Edit tersimpan sebagai draft. Klik <strong>Publish</strong> di toolbar untuk simpan ke server.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
