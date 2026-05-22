"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import LeadAvatar from "./LeadAvatar";
import { fundingPlanLabelId, type Lead } from "@/lib/leads/types";
import { formatJakartaStamp, formatJakartaRelative } from "@/lib/datetime-id";

/**
 * Right slide-over for the Smart Inbox. Read-mostly: gives admin a
 * fast triage view of one lead — AI brief, target, pipeline progress,
 * activity timeline. Full editing (call panel, mentor match, etc) lives
 * on the dedicated /[id] detail page; this panel links there.
 *
 * Quick-action buttons (Reachout + WA) hit the same API as the row
 * hover buttons; parent owns the dispatch + busy state via callback.
 */

interface DetailResponse {
  history?: Array<{ id: string; fromStage: string | null; toStage: string; changedBy: string; note: string | null; createdAt: string }>;
  statuses?: Array<{ id: string; stepId: string; status: string; completedAt: string | null; completedBy: string | null }>;
  steps?: Array<{ id: string; order: number; label: string; description: string | null; autoTrigger: string | null; isActive: boolean }>;
}

interface Props {
  lead: Lead;
  busy: boolean;
  onClose: () => void;
  onReachout: (leadId: string, channel: "email" | "whatsapp" | "both") => void;
  /** Called after a successful DELETE so parent can refresh list + close panel. */
  onDeleted?: () => void;
}

const formatStamp = formatJakartaStamp;
const relativeTime = formatJakartaRelative;

function aiBriefFor(lead: Lead): string {
  switch (lead.bucket) {
    case "A":
      return "Lead bucket A — mentor & partner kampus tersedia. Prioritas tinggi: kirim outreach personal dalam 24 jam, ajak booking call.";
    case "B":
      return "Mentor di negara tujuan ada, tapi kampus spesifik belum partner. Saran: outreach + tawarkan alternatif kampus partner di negara yang sama.";
    case "C":
      return "Kampus partner tapi belum ada mentor di negara tersebut. Saran: ajak waitlist, atau gunakan mentor lintas-region.";
    case "D":
      return "Mentor & kampus belum tersedia. Kirim template confirmation (D) dan tawarkan alternatif coverage.";
    case "incomplete":
      return "Form Tally belum lengkap — target kampus/program kosong. Kirim re-engagement template (incomplete) untuk minta lead melengkapi.";
    case "domestic":
      return "Target studi domestik (Indonesia) — di luar scope Satu Tuju. Kirim polite decline (domestic) + sarankan komunitas WA.";
    default:
      return "Bucket belum diklasifikasi. Review manual + override bucket sebelum kirim outreach.";
  }
}

export default function LeadDetailPanel({ lead, busy, onClose, onReachout, onDeleted }: Props) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"email" | "whatsapp" | "both">("both");
  const [reachoutConfirmOpen, setReachoutConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const hasWa = !!lead.whatsappNumber;
  // If lead has no WA, default to email-only so the Reachout button
  // doesn't prompt a skip on first click.
  useEffect(() => {
    if (!hasWa && (channel === "whatsapp" || channel === "both")) setChannel("email");
  }, [hasWa, channel, lead.id]);

  // Reset modal state whenever the panel switches to a different lead.
  useEffect(() => {
    setReachoutConfirmOpen(false);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setDeleteErr(null);
  }, [lead.id]);

  function channelLabel(c: typeof channel): string {
    if (c === "email") return "Email saja";
    if (c === "whatsapp") return "WhatsApp saja";
    return "Email + WhatsApp (paralel)";
  }

  function confirmReachout() {
    setReachoutConfirmOpen(false);
    onReachout(lead.id, channel);
  }

  async function deleteLead() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      const res = await fetch(
        `/api/new-leads/${lead.id}?confirm=${encodeURIComponent(lead.name)}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteErr(body.error || `HTTP ${res.status}`);
        return;
      }
      // Success — close panel + tell parent to refresh.
      setDeleteConfirmOpen(false);
      onDeleted?.();
      onClose();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setDeleting(false);
    }
  }

  const deleteNameMatches = deleteConfirmText.trim() === lead.name.trim();

  // Fetch full lead detail (history + pipeline checklist) so the panel
  // can show real timeline + step states. Lightweight (~5 KB).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/new-leads/${lead.id}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  const steps = data?.steps ?? [];
  const statuses = data?.statuses ?? [];
  const statusByStep = new Map(statuses.map((s) => [s.stepId, s]));
  const history = data?.history ?? [];

  const doneCount = statuses.filter((s) => s.status === "done").length;
  const totalCount = steps.filter((s) => s.isActive).length;

  // Activity timeline = stage history events newest-first.
  const activity = history.slice(0, 8);

  return (
    <aside className="w-[360px] flex-shrink-0 self-start sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden bg-surface border border-border rounded-xl flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start gap-3">
        <LeadAvatar name={lead.name} size={44} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] text-foreground font-[family-name:var(--font-heading)] truncate">
            {lead.name}
          </div>
          <a href={`mailto:${lead.email}`} className="text-[12px] text-text-muted hover:text-primary truncate block">
            {lead.email}
          </a>
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">
            <LeadBucketBadge bucket={lead.bucket} />
            <LeadStageBadge stage={lead.stage} />
            {lead.fundingPlan && (
              <span className="bg-yellow-50 text-yellow-900 px-2 py-0.5 rounded text-[11px] font-medium">
                {fundingPlanLabelId(lead.fundingPlan)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="w-8 h-8 rounded-md text-text-muted hover:text-foreground hover:bg-surface-elevated inline-flex items-center justify-center"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 border-b border-border/60 flex gap-2 items-center flex-wrap">
        <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px]">
          {(["email", "whatsapp", "both"] as const).map((ch) => {
            const disabled = ch !== "email" && !hasWa;
            const isActive = channel === ch;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => !disabled && setChannel(ch)}
                disabled={disabled}
                title={disabled ? "Lead tanpa nomor WA" : undefined}
                className={`px-2.5 py-1.5 transition ${
                  isActive
                    ? "bg-primary text-white"
                    : "bg-surface text-text-muted hover:bg-surface-elevated"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {ch === "email" ? "Email" : ch === "whatsapp" ? "WA" : "Email + WA"}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setReachoutConfirmOpen(true)}
          disabled={busy}
          className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="send" size={13} />
          {busy ? "Mengirim…" : "Reachout"}
        </button>
        <Link
          href={`/dashboard/admin/new-leads/${lead.id}`}
          className="btn-ghost text-xs inline-flex items-center gap-1.5 ml-auto"
        >
          Detail lengkap
          <Icon name="arrow-right" size={12} />
        </Link>
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          disabled={busy || deleting}
          title="Hapus lead secara permanen"
          className="text-xs inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
        >
          <Icon name="trash" size={12} />
          Hapus
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* AI brief */}
        <div className="m-5 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-[12.5px] leading-relaxed text-yellow-900 flex gap-2.5">
          <Icon name="sparkles" size={14} className="text-yellow-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Saran AI · </strong>
            {aiBriefFor(lead)}
          </div>
        </div>

        {/* Target */}
        <Section title="Target studi">
          <div className="text-[13px] text-foreground leading-snug">
            {lead.targetCampusAndProgram || (
              <span className="italic text-text-muted-2">Belum diisi</span>
            )}
          </div>
          <div className="flex gap-3 mt-1.5 text-[12px] text-text-muted flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Icon name="globe" size={12} />
              {lead.parsedCountry || "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="tag" size={12} />
              {fundingPlanLabelId(lead.fundingPlan)}
            </span>
            {lead.whatsappNumber && (
              <span className="inline-flex items-center gap-1">
                <Icon name="chat" size={12} />
                <span className="font-mono text-[11px]">{lead.whatsappNumber}</span>
              </span>
            )}
          </div>
        </Section>

        {/* Pipeline progress */}
        <Section
          title={`Pipeline progress · ${doneCount}/${totalCount}`}
          action={
            <Link
              href={`/dashboard/admin/new-leads/${lead.id}`}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Buka checklist
            </Link>
          }
        >
          {loading ? (
            <div className="text-[12px] text-text-muted-2">Loading…</div>
          ) : steps.length === 0 ? (
            <div className="text-[12px] text-text-muted-2 italic">Belum ada step aktif.</div>
          ) : (
            <div className="space-y-2">
              {steps.filter((s) => s.isActive).map((step) => {
                const st = statusByStep.get(step.id);
                const done = st?.status === "done";
                return (
                  <div key={step.id} className="flex gap-2.5 items-center text-[12.5px]">
                    <span
                      className={`w-[18px] h-[18px] rounded-full inline-flex items-center justify-center flex-shrink-0 ${
                        done
                          ? "bg-primary border border-primary text-white"
                          : "bg-surface border border-border"
                      }`}
                    >
                      {done && <Icon name="check" size={11} />}
                    </span>
                    <span className={`flex-1 ${done ? "text-foreground" : "text-text-muted"}`}>
                      {step.label}
                    </span>
                    {st?.completedAt && (
                      <span className="text-[11px] text-text-muted-2">
                        {relativeTime(st.completedAt)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Activity timeline */}
        <Section title="Aktivitas terbaru">
          {loading ? (
            <div className="text-[12px] text-text-muted-2">Loading…</div>
          ) : activity.length === 0 ? (
            <div className="text-[12px] text-text-muted-2 italic">Belum ada aktivitas.</div>
          ) : (
            <div className="space-y-2.5 text-[12.5px]">
              {activity.map((h) => (
                <div key={h.id} className="flex gap-2.5 items-start">
                  <span className="text-text-muted-2 mt-0.5">
                    <Icon name="dot" size={10} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground">
                      {h.fromStage ? (
                        <>
                          <span className="font-mono text-[11px] text-text-muted-2">{h.fromStage}</span>
                          {" → "}
                          <span className="font-mono text-[11px] font-semibold">{h.toStage}</span>
                        </>
                      ) : (
                        <span className="font-mono text-[11px] font-semibold">{h.toStage}</span>
                      )}
                    </div>
                    {h.note && (
                      <div className="text-[11.5px] text-text-muted italic leading-snug mt-0.5 line-clamp-2">
                        {h.note}
                      </div>
                    )}
                    <div className="text-[10.5px] text-text-muted-2 mt-0.5">
                      {formatStamp(h.createdAt)} · {h.changedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Note */}
        <Section title="Info Lead">
          <div className="text-[12px] text-text-muted-2 italic">
            Untuk edit notes, classification, mentor matching, dll — buka{" "}
            <Link
              href={`/dashboard/admin/new-leads/${lead.id}`}
              className="text-primary font-semibold hover:underline"
            >
              detail lengkap →
            </Link>
          </div>
        </Section>
      </div>

      {/* Reachout confirm modal — keeps the firing path 1-click but
          forces admin to eyeball the recipient + channel before the
          API call goes out. Less ceremony than the bulk modal since
          this is one lead at a time. */}
      <Modal
        open={reachoutConfirmOpen}
        onClose={() => (busy ? null : setReachoutConfirmOpen(false))}
        title={`Kirim outreach ke ${lead.name}?`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setReachoutConfirmOpen(false)}
              disabled={busy}
              className="btn-ghost"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmReachout}
              disabled={busy}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? "Mengirim…" : "Kirim sekarang"}
            </button>
          </>
        }
      >
        <div className="space-y-2.5 text-sm">
          <div className="text-xs text-text-muted">
            Outreach akan dikirim ke lead di bawah. Template otomatis dipilih
            berdasarkan bucket lead.
          </div>
          <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <span className="text-text-muted-2 text-[11px] uppercase tracking-wider">To</span>
              <span className="text-foreground font-medium text-right">{lead.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-muted-2 text-[11px] uppercase tracking-wider">Email</span>
              <span className="text-foreground font-mono text-[12px] truncate">{lead.email}</span>
            </div>
            {lead.whatsappNumber && (
              <div className="flex justify-between gap-3">
                <span className="text-text-muted-2 text-[11px] uppercase tracking-wider">WhatsApp</span>
                <span className="text-foreground font-mono text-[12px]">{lead.whatsappNumber}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-text-muted-2 text-[11px] uppercase tracking-wider">Bucket</span>
              <LeadBucketBadge bucket={lead.bucket} />
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-text-muted-2 text-[11px] uppercase tracking-wider">Channel</span>
              <span className="text-foreground font-medium">{channelLabel(channel)}</span>
            </div>
          </div>
          {(channel === "whatsapp" || channel === "both") && !lead.whatsappNumber && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              ⚠ Lead tidak punya nomor WA — channel WA akan di-skip server-side. Email tetap dikirim.
            </p>
          )}
        </div>
      </Modal>

      {/* Delete confirm modal — type-name-to-confirm. Multi-step
          friction so a misclick can't wipe a real lead. */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => (deleting ? null : setDeleteConfirmOpen(false))}
        title={`Hapus lead ${lead.name}?`}
        variant="danger"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="btn-ghost"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void deleteLead()}
              disabled={deleting || !deleteNameMatches}
              className="btn-danger disabled:opacity-50"
            >
              {deleting ? "Menghapus…" : "Hapus permanen"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-text-foreground">
            Aksi ini <strong className="text-rose-700">permanen dan tidak bisa di-undo</strong>.
            Yang akan dihapus dari database:
          </p>
          <ul className="text-xs text-text-muted space-y-1 list-disc pl-5">
            <li>Lead row (id <span className="font-mono">{lead.id}</span>)</li>
            <li>Semua stage history (timeline transisi)</li>
            <li>Semua outreach log (email + WA terkirim)</li>
            <li>Semua step status (pipeline checklist)</li>
          </ul>
          {lead.tallySubmissionId && (
            <p className="text-[11px] text-text-muted bg-surface-elevated/40 border border-border/60 rounded px-2.5 py-1.5">
              ℹ Lead ini bersumber dari Tally (<code className="font-mono">tallySubmissionId</code> ada).
              &ldquo;Sync from Tally&rdquo; akan re-import lead ini kalau Tally submission-nya masih ada — tapi
              history + outreach log tidak akan kembali.
            </p>
          )}
          <div className="pt-2 border-t border-border/60">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Ketik nama lead persis untuk konfirmasi:{" "}
              <code className="font-mono text-rose-700 select-none">{lead.name}</code>
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoFocus
              placeholder={lead.name}
              className="input-field text-sm font-mono"
            />
            {deleteConfirmText.length > 0 && !deleteNameMatches && (
              <p className="text-[11px] text-rose-600 mt-1">
                Belum match. Ketik persis: <code className="font-mono">{lead.name}</code>
              </p>
            )}
          </div>
          {deleteErr && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-2">
              ⚠ {deleteErr}
            </div>
          )}
        </div>
      </Modal>
    </aside>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 border-t border-border/60">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] font-semibold text-text-muted-2 uppercase tracking-[0.06em]">
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
