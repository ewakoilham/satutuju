"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { formatJakartaDateTime, formatJakartaRelative } from "@/lib/datetime-id";
import {
  fundingPlanLabelId,
  LEAD_NOTE_EDIT_WINDOW_MS,
  type LeadNoteThread,
  type MentorLeadView,
} from "@/lib/leads/types";

/**
 * Phase 13.1 — mentor lead detail rendered as a side panel beside the
 * list (no page navigation). Mounted by the list page whenever
 * `leadId` is set; unmounted when the mentor closes it.
 *
 * Internal state (drafts, edit form) lives inside the panel and resets
 * when `leadId` prop changes so swapping leads in the list doesn't
 * leak typed-but-unsaved content into a different lead.
 *
 * `onChanged` lets the parent refetch the list (note counts + flag
 * chips) after any mutation here.
 */

interface DetailResponse {
  lead: MentorLeadView;
  flaggedByMe: boolean;
  flagContext: string | null;
  notes: LeadNoteThread[];
}

interface Props {
  leadId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export default function MentorLeadDetailPanel({ leadId, onClose, onChanged }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [flagContext, setFlagContext] = useState("");
  const [flagBusy, setFlagBusy] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mentor/leads/${leadId}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as DetailResponse;
      setData(json);
      setFlagContext(json.flagContext ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Reset all drafts + refetch when the mentor swaps leads from the list.
  useEffect(() => {
    setNoteDraft("");
    setEditingId(null);
    setEditDraft("");
    void fetchDetail();
  }, [leadId, fetchDetail]);

  async function toggleFlag() {
    if (!data || flagBusy) return;
    setFlagBusy(true);
    try {
      const method = data.flaggedByMe ? "DELETE" : "POST";
      const body = method === "POST" ? JSON.stringify({ context: flagContext.trim() || null }) : undefined;
      const res = await fetch(`/api/mentor/leads/${leadId}/flag`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      await fetchDetail();
      onChanged?.();
    } finally {
      setFlagBusy(false);
    }
  }

  async function updateFlagContext() {
    if (!data?.flaggedByMe || flagBusy) return;
    setFlagBusy(true);
    try {
      await fetch(`/api/mentor/leads/${leadId}/flag`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: flagContext.trim() || null }),
      });
      await fetchDetail();
    } finally {
      setFlagBusy(false);
    }
  }

  async function submitNote() {
    const content = noteDraft.trim();
    if (!content || noteBusy) return;
    setNoteBusy(true);
    try {
      const res = await fetch("/api/lead-notes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, content }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `HTTP ${res.status}`);
        return;
      }
      setNoteDraft("");
      await fetchDetail();
      onChanged?.();
    } finally {
      setNoteBusy(false);
    }
  }

  async function saveEdit(noteId: string) {
    const content = editDraft.trim();
    if (!content) return;
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
    await fetchDetail();
  }

  return (
    <aside className="xl:w-[420px] w-full xl:flex-shrink-0 bg-surface border border-border rounded-xl flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-3rem)] overflow-hidden">
      {/* Panel header — sticky close + share */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-surface-elevated/30 flex-shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted-2">
          Detail lead
        </span>
        <div className="flex items-center gap-1">
          <a
            href={`/dashboard/leads/${leadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-[11px] inline-flex items-center gap-1"
            title="Buka di tab baru"
          >
            <Icon name="external-link" size={11} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-xs p-1"
            title="Tutup panel"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <SkeletonDashboard />
        ) : err || !data ? (
          <div className="text-sm text-danger">{err || "Lead tidak ditemukan"}</div>
        ) : (
          <PanelBody
            data={data}
            flagBusy={flagBusy}
            flagContext={flagContext}
            setFlagContext={setFlagContext}
            onToggleFlag={toggleFlag}
            onUpdateFlagContext={updateFlagContext}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            noteBusy={noteBusy}
            onSubmitNote={submitNote}
            editingId={editingId}
            setEditingId={setEditingId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onSaveEdit={saveEdit}
          />
        )}
      </div>
    </aside>
  );
}

interface PanelBodyProps {
  data: DetailResponse;
  flagBusy: boolean;
  flagContext: string;
  setFlagContext: (v: string) => void;
  onToggleFlag: () => void;
  onUpdateFlagContext: () => void;
  noteDraft: string;
  setNoteDraft: (v: string) => void;
  noteBusy: boolean;
  onSubmitNote: () => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  editDraft: string;
  setEditDraft: (v: string) => void;
  onSaveEdit: (id: string) => void;
}

function PanelBody({
  data,
  flagBusy,
  flagContext,
  setFlagContext,
  onToggleFlag,
  onUpdateFlagContext,
  noteDraft,
  setNoteDraft,
  noteBusy,
  onSubmitNote,
  editingId,
  setEditingId,
  editDraft,
  setEditDraft,
  onSaveEdit,
}: PanelBodyProps) {
  const { lead, flaggedByMe, notes } = data;
  return (
    <>
      {/* Header — name + contacts */}
      <div>
        <h1 className="text-[20px] font-extrabold leading-tight text-foreground font-[family-name:var(--font-heading)] tracking-tight">
          {lead.name}
        </h1>
        <div className="flex gap-2 mt-1.5 text-[11.5px] text-text-muted items-center flex-wrap">
          <a href={`mailto:${lead.email}`} className="hover:text-primary truncate max-w-[200px]">{lead.email}</a>
          {lead.whatsappNumber && (
            <>
              <span>·</span>
              <a
                href={`https://wa.me/${lead.whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10.5px] hover:text-primary"
              >WA {lead.whatsappNumber}</a>
            </>
          )}
        </div>
        {lead.submittedAt && (
          <div className="text-[10.5px] text-text-muted-2 mt-0.5" title={formatJakartaDateTime(lead.submittedAt)}>
            Submit {formatJakartaRelative(lead.submittedAt)}
          </div>
        )}
      </div>

      {/* Profile / target */}
      <section className="space-y-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted-2">
          Tujuan & Profile
        </h2>
        <div className="grid grid-cols-1 gap-2 text-[12.5px]">
          <Field label="Target kampus / program">{lead.targetCampusAndProgram || <em className="text-text-muted-2">belum diisi</em>}</Field>
          <Field label="Funding plan">{fundingPlanLabelId(lead.fundingPlan)}</Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Negara">{lead.parsedCountry || <em className="text-text-muted-2">—</em>}</Field>
            <Field label="Field">{lead.parsedField || <em className="text-text-muted-2">—</em>}</Field>
          </div>
          {lead.parsedCampus && <Field label="Kampus (parsed)">{lead.parsedCampus}</Field>}
        </div>
      </section>

      {/* Flag */}
      <section className="space-y-2 border-t border-border/60 pt-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted-2">
          Tandai lead ini
        </h2>
        <button
          type="button"
          onClick={onToggleFlag}
          disabled={flagBusy}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${
            flaggedByMe
              ? "bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
              : "btn-primary"
          }`}
        >
          <Icon name={flaggedByMe ? "check" : "flag"} size={12} />
          {flaggedByMe ? "Sudah ditandai · klik untuk hapus" : "Tandai saya kenal"}
        </button>
        {flaggedByMe && (
          <div className="space-y-1">
            <textarea
              value={flagContext}
              onChange={(e) => setFlagContext(e.target.value)}
              onBlur={() => {
                if ((flagContext.trim() || null) !== (data.flagContext ?? null)) onUpdateFlagContext();
              }}
              placeholder="mis. Mantan mentee tahun 2024 — strong IELTS"
              rows={2}
              maxLength={500}
              className="w-full text-[12px] px-2.5 py-1.5 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-none"
            />
            <p className="text-[10px] text-text-muted-2 italic">Auto-save saat blur.</p>
          </div>
        )}
      </section>

      {/* Notes thread */}
      <section className="space-y-3 border-t border-border/60 pt-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-text-muted-2">
          Catatan saya untuk admin
        </h2>

        {/* Composer */}
        <div className="space-y-1.5">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Tulis catatan untuk admin…"
            rows={3}
            maxLength={4000}
            className="w-full text-[12.5px] px-2.5 py-2 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-text-muted-2 italic">
              Bisa edit 15 menit. Tidak bisa hapus.
            </span>
            <button
              type="button"
              onClick={onSubmitNote}
              disabled={noteBusy || !noteDraft.trim()}
              className="btn-primary text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Icon name="send" size={11} /> {noteBusy ? "Mengirim…" : "Kirim"}
            </button>
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="text-[11.5px] text-text-muted-2 italic py-2 text-center border-t border-border/60">
            Belum ada catatan.
          </div>
        ) : (
          <ul className="space-y-2.5 pt-1">
            {notes.map((n) => {
              const isEditing = editingId === n.id;
              const ageMs = Date.now() - new Date(n.createdAt).getTime();
              const canEdit = ageMs <= LEAD_NOTE_EDIT_WINDOW_MS;
              return (
                <li key={n.id} className="space-y-1.5">
                  <div className="bg-surface-elevated/40 rounded-lg p-2.5 border border-border/40">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-[11.5px]">
                        <span className="font-semibold text-foreground">{n.authorName}</span>
                        <span className="text-[10px] text-text-muted-2 italic" title={formatJakartaDateTime(n.createdAt)}>
                          {formatJakartaRelative(n.createdAt)}
                          {n.editedAt && " · (diedit)"}
                        </span>
                      </div>
                      {canEdit && !isEditing && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(n.id); setEditDraft(n.content); }}
                          className="text-[10.5px] text-primary hover:underline"
                        >Edit</button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          maxLength={4000}
                          className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-none"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button type="button" onClick={() => setEditingId(null)} className="btn-ghost text-[11px]">Batal</button>
                          <button type="button" onClick={() => void onSaveEdit(n.id)} className="btn-primary text-[11px]">Simpan</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12.5px] text-foreground whitespace-pre-wrap leading-relaxed">{n.content}</div>
                    )}
                  </div>

                  {n.replies.length > 0 && (
                    <ul className="ml-4 space-y-1.5 border-l-2 border-primary-200 pl-2.5">
                      {n.replies.map((r) => (
                        <li key={r.id} className="bg-primary-50/40 rounded-lg p-2 border border-primary-200/40">
                          <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
                            <span className="font-semibold text-primary">{r.authorName} (admin)</span>
                            <span className="text-[10px] text-text-muted-2 italic" title={formatJakartaDateTime(r.createdAt)}>
                              {formatJakartaRelative(r.createdAt)}
                              {r.editedAt && " · (diedit)"}
                            </span>
                          </div>
                          <div className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{r.content}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-text-muted-2 uppercase tracking-[0.05em]">{label}</div>
      <div className="text-foreground mt-0.5 break-words">{children}</div>
    </div>
  );
}
