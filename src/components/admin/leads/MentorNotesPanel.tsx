"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { formatJakartaDateTime, formatJakartaRelative } from "@/lib/datetime-id";
import {
  LEAD_NOTE_EDIT_WINDOW_MS,
  type LeadNoteThread,
  type MentorLeadFlagWithMentor,
} from "@/lib/leads/types";

interface Props {
  leadId: string;
  /** Tree of mentor notes with admin replies nested (from /api/new-leads/[id]). */
  notes: LeadNoteThread[];
  /** Mentor flags (chips). */
  flags: MentorLeadFlagWithMentor[];
  /** Current admin user id — to gate edit-pencil on their own replies. */
  currentUserId: string;
  /** Refetch the parent so newly-saved replies / edits show up. */
  onChanged: () => void;
}

/**
 * Phase 13 — admin-side surface for mentor input on a lead:
 *  - "Lead ditandai oleh mentor" chips (one per flag)
 *  - Threaded notes: each mentor's top-level note + admin replies inline
 *  - Inline reply composer under each note
 *  - 15-min edit window for admin's own replies
 */
export default function MentorNotesPanel({ leadId, notes, flags, currentUserId, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function submitReply(parentNoteId: string) {
    const content = (replyDraft[parentNoteId] ?? "").trim();
    if (!content || busy) return;
    setBusy(parentNoteId);
    try {
      const res = await fetch("/api/lead-notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, parentNoteId, content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      setReplyDraft((prev) => ({ ...prev, [parentNoteId]: "" }));
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(noteId: string) {
    const content = editDraft.trim();
    if (!content) return;
    setBusy(noteId);
    try {
      const res = await fetch(`/api/lead-notes/${noteId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      setEditingId(null);
      setEditDraft("");
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  const totalReplies = notes.reduce((acc, n) => acc + n.replies.length, 0);

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2 flex items-center gap-2">
          <Icon name="chat" size={14} className="text-primary" />
          Catatan dari Mentor
          <span className="text-text-muted-2 font-normal normal-case tracking-normal">
            {notes.length} catatan · {totalReplies} balasan
          </span>
        </h2>
      </div>

      {/* Flag chips */}
      {flags.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-text-muted-2">
            Lead ditandai oleh mentor
          </div>
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <div
                key={f.id}
                className="inline-flex items-start gap-1.5 max-w-md px-2.5 py-1.5 rounded-lg text-[11.5px] bg-amber-50 text-amber-900 border border-amber-200"
                title={formatJakartaDateTime(f.createdAt)}
              >
                <Icon name="flag" size={11} className="text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="leading-snug">
                  <span className="font-semibold">{f.mentorName}</span>
                  {f.context && <span className="text-amber-800"> · {f.context}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes thread */}
      {notes.length === 0 && flags.length === 0 && (
        <div className="text-[12.5px] text-text-muted-2 italic py-3 text-center">
          Belum ada catatan atau flag dari mentor untuk lead ini.
        </div>
      )}

      {notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="space-y-2">
              <div className="bg-surface-elevated/40 rounded-lg p-3 border border-border/40">
                <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="font-semibold text-foreground">{n.authorName}</span>
                    <span className="text-[10.5px] text-text-muted-2 italic" title={formatJakartaDateTime(n.createdAt)}>
                      mentor · {formatJakartaRelative(n.createdAt)}
                      {n.editedAt && " · (diedit)"}
                    </span>
                  </div>
                </div>
                <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{n.content}</div>
              </div>

              {/* Replies (admin) */}
              {n.replies.length > 0 && (
                <ul className="ml-6 space-y-2 border-l-2 border-primary-200 pl-3">
                  {n.replies.map((r) => {
                    const isEditing = editingId === r.id;
                    const ageMs = Date.now() - new Date(r.createdAt).getTime();
                    const canEdit = r.authorId === currentUserId && ageMs <= LEAD_NOTE_EDIT_WINDOW_MS;
                    return (
                      <li key={r.id} className="bg-primary-50/40 rounded-lg p-2.5 border border-primary-200/40">
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-2 text-[11.5px]">
                            <span className="font-semibold text-primary">{r.authorName}</span>
                            <span className="text-[10px] text-text-muted-2 italic" title={formatJakartaDateTime(r.createdAt)}>
                              admin · {formatJakartaRelative(r.createdAt)}
                              {r.editedAt && " · (diedit)"}
                            </span>
                          </div>
                          {canEdit && !isEditing && (
                            <button
                              type="button"
                              onClick={() => { setEditingId(r.id); setEditDraft(r.content); }}
                              className="text-[11px] text-primary hover:underline"
                            >Edit</button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={2}
                              maxLength={4000}
                              className="w-full text-[12.5px] px-2.5 py-2 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => setEditingId(null)} className="btn-ghost text-xs">Batal</button>
                              <button
                                type="button"
                                onClick={() => void saveEdit(r.id)}
                                disabled={busy === r.id}
                                className="btn-primary text-xs"
                              >Simpan</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[12.5px] text-foreground whitespace-pre-wrap leading-relaxed">{r.content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Reply composer */}
              <div className="ml-6 space-y-1.5">
                <textarea
                  value={replyDraft[n.id] ?? ""}
                  onChange={(e) => setReplyDraft((p) => ({ ...p, [n.id]: e.target.value }))}
                  placeholder="Tulis balasan untuk mentor…"
                  rows={2}
                  maxLength={4000}
                  className="w-full text-[12.5px] px-2.5 py-1.5 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-y"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void submitReply(n.id)}
                    disabled={busy === n.id || !(replyDraft[n.id] ?? "").trim()}
                    className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Icon name="send" size={11} /> {busy === n.id ? "Mengirim…" : "Balas"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
