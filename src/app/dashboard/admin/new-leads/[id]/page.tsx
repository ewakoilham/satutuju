"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { formatJakartaStamp, formatJakartaRelative } from "@/lib/datetime-id";
import OutreachPanel from "@/components/admin/leads/OutreachPanel";
import MentorMatchPanel from "@/components/admin/leads/MentorMatchPanel";
import CallBanner from "@/components/admin/leads/cockpit/CallBanner";
import ContextRail from "@/components/admin/leads/cockpit/ContextRail";
import CallWorkspace from "@/components/admin/leads/cockpit/CallWorkspace";
import DecisionPad, { suggestDepositTier } from "@/components/admin/leads/cockpit/DecisionPad";
import {
  CALL_PANEL_STAGES,
  LEAD_STAGES,
  STAGE_LABEL,
  type Lead,
  type LeadStage,
  type LeadStageHistory,
  type LeadNoteThread,
  type MentorLeadFlagWithMentor,
  type OutreachLog,
  type LeadStepDefinition,
  type LeadStepStatusRow,
} from "@/lib/leads/types";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import type { SaveState } from "@/components/admin/leads/cockpit/DecisionPad";
import { useUser } from "@/lib/hooks";

/**
 * Call Cockpit detail page (Phase 8). Three-column layout optimized for
 * admin who is ON the call:
 *
 *   ┌───────────────┬──────────────────────────────┬──────────────┐
 *   │ Context rail  │  Tabbed workspace            │  Decision    │
 *   │ (lead info,   │  (Pre-call brief / Live      │  pad         │
 *   │  target,      │   notes / Original form)     │  (score +    │
 *   │  engagement,  │                              │   tier +     │
 *   │  mentor cand) │                              │   decision)  │
 *   └───────────────┴──────────────────────────────┴──────────────┘
 *
 * Below cockpit (collapsible): Pipeline checklist, Outreach history,
 * Mentor Matching (when stage = deposit_paid / matched).
 */

interface DetailResponse {
  lead: Lead;
  history: LeadStageHistory[];
  outreach: OutreachLog[];
  steps: LeadStepDefinition[];
  statuses: LeadStepStatusRow[];
  notes?: LeadNoteThread[];
  flags?: MentorLeadFlagWithMentor[];
}

const READINESS_LENGTH = 6;

// Timestamp helpers — pulled from src/lib/datetime-id.ts so we always
// display WIB (Asia/Jakarta), regardless of where the request is served
// from. parseAsUtc inside the helper handles the Supabase-without-Z quirk.
const formatStamp = formatJakartaStamp;
const relativeTime = formatJakartaRelative;

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user: currentUser } = useUser();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Call Cockpit form state (driven by lead, reset on fetch) ────────
  const [readiness, setReadiness] = useState<boolean[]>(Array(READINESS_LENGTH).fill(false));
  const [interviewer, setInterviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [redFlags, setRedFlags] = useState("");
  const [depositTier, setDepositTier] = useState<number | null>(null);
  const [stageNote, setStageNote] = useState("");
  // Auto-save indicator. saving = in-flight; saved = transient ✓; error = failed.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Tracks whether form state has been edited since last fetch — guards
  // against auto-saving immediately on initial sync.
  const dirtyRef = useRef(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/new-leads/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as DetailResponse;
      setData(json);
      setError(null);

      // Sync form state with the latest lead. Reset dirty flag so the
      // next save effect doesn't auto-fire on initial hydration.
      const l = json.lead;
      const score = l.readinessScore ?? 0;
      setReadiness(Array.from({ length: READINESS_LENGTH }, (_, i) => i < score));
      setInterviewer(l.assignedInterviewer ?? "");
      setNotes(l.callNotes ?? "");
      setRedFlags(l.redFlags ?? "");
      setDepositTier(l.depositTier);
      setStageNote(l.stageNote ?? "");
      dirtyRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  function toggleReadiness(i: number) {
    dirtyRef.current = true;
    setReadiness((r) => r.map((v, idx) => (idx === i ? !v : v)));
  }

  // Auto-save effect — debounces ~600ms after the last edit and PATCHes
  // the lead. Replaces the old "Simpan & Mark Completed" button flow.
  // Stage advancement is OUT of scope here — handled by /stage via the
  // stage dropdown, pipeline checklist clicks, or terminal buttons.
  useEffect(() => {
    if (!data) return;
    if (!dirtyRef.current) return;
    const ctrl = new AbortController();
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const score = readiness.filter(Boolean).length;
        const effectiveTier = depositTier ?? suggestDepositTier(score);
        const res = await fetch(`/api/new-leads/${data.lead.id}/call`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            readinessScore: score,
            callNotes: notes.trim() || null,
            redFlags: redFlags.trim() || null,
            depositTier: effectiveTier,
            assignedInterviewer: interviewer.trim() || null,
            stageNote: stageNote.trim() || null,
          }),
        });
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        setSaveState("saved");
        dirtyRef.current = false;
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1800);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSaveState("error");
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness, notes, redFlags, depositTier, interviewer, stageNote]);

  /** Manually advance/revert stage via the header dropdown. Free-form —
   *  admin can pick any of 14 stages. Confirms before applying. */
  const [stageBusy, setStageBusy] = useState(false);
  async function changeStage(next: LeadStage) {
    if (!data) return;
    if (next === data.lead.stage) return;
    if (!confirm(
      `Pindahkan stage lead dari "${STAGE_LABEL[data.lead.stage]}" ke "${STAGE_LABEL[next]}"?`,
    )) return;
    setStageBusy(true);
    try {
      const res = await fetch(`/api/new-leads/${data.lead.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage: next, note: "Manual advance via stage dropdown" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || `HTTP ${res.status}`);
        return;
      }
      await fetchDetail();
    } finally {
      setStageBusy(false);
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/admin/new-leads" className="btn-ghost inline-flex items-center gap-1.5 text-sm">
          <Icon name="chevron-left" size={14} /> Kembali
        </Link>
        <div className="card p-6 text-sm text-danger">{error || "Lead tidak ditemukan"}</div>
      </div>
    );
  }

  const { lead, history, outreach, steps, statuses } = data;
  const inCallStage = CALL_PANEL_STAGES.includes(lead.stage);
  const readOnly = lead.stage === "matched"; // frozen after mentor match
  const score = readiness.filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/admin/new-leads"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-foreground"
      >
        <Icon name="chevron-left" size={14} />
        Semua leads
        <span className="opacity-40">/</span>
        <span className="font-mono text-[11px] text-text-muted-2">{lead.id}</span>
      </Link>

      {/* Page header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[28px] font-extrabold leading-none text-foreground font-[family-name:var(--font-heading)] tracking-tight">
            {lead.name}
          </h1>
          <div className="flex gap-2.5 mt-1.5 text-[12.5px] text-text-muted items-center flex-wrap">
            <a href={`mailto:${lead.email}`} className="hover:text-primary">{lead.email}</a>
            {lead.whatsappNumber && (
              <>
                <span>·</span>
                <span className="font-mono text-[11px]">WA {lead.whatsappNumber}</span>
              </>
            )}
            <span>·</span>
            <span>Last update {relativeTime(lead.updatedAt)}</span>
          </div>
          {/* Stage dropdown — free admin control, can move forward or
              backward through any of the 14 stages. Confirmation modal
              inside changeStage(). */}
          <div className="flex gap-2 mt-2.5 items-center">
            <LeadStageBadge stage={lead.stage} />
            <select
              value={lead.stage}
              onChange={(e) => void changeStage(e.target.value as LeadStage)}
              disabled={stageBusy || readOnly}
              className="text-[11.5px] bg-surface border border-border rounded-lg px-2 py-1 text-foreground hover:border-primary-200 focus:outline-none focus:border-primary disabled:opacity-50"
              title="Pindahkan stage lead — bebas maju/mundur"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
              ))}
            </select>
            {stageBusy && <span className="text-[10px] text-text-muted-2 italic">Memperbarui…</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`mailto:${lead.email}`}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <Icon name="mail" size={13} /> Reply email
          </a>
          {lead.whatsappNumber && (
            <a
              href={`https://wa.me/${lead.whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs inline-flex items-center gap-1.5"
            >
              <Icon name="chat" size={13} /> WA
            </a>
          )}
        </div>
      </div>

      {/* Call banner — shown whenever a call is scheduled, regardless of
          whether the call has happened yet (the pill flips to "selesai"
          after the slot passes). */}
      {lead.callScheduledAt && (
        <CallBanner
          scheduledAt={lead.callScheduledAt}
          completedAt={lead.callCompletedAt}
          currentStage={lead.stage}
          interviewer={lead.assignedInterviewer || interviewer}
          // We don't currently store the Meet link per-lead. When that
          // lands, pull from lead.meetLink or wherever the calendar
          // sync writes it. For now no link.
          meetLink={null}
        />
      )}

      {/* 3-column cockpit */}
      <div className="flex gap-3.5 items-start flex-col xl:flex-row">
        <ContextRail
          lead={lead}
          history={history}
          outreach={outreach}
          notes={data.notes ?? []}
          flags={data.flags ?? []}
          currentUserId={currentUser?.userId}
          onMentorNotesChanged={fetchDetail}
        />
        <CallWorkspace
          lead={lead}
          readiness={readiness}
          onToggleReadiness={toggleReadiness}
          notes={notes}
          onNotesChange={(v) => { dirtyRef.current = true; setNotes(v); }}
          redFlags={redFlags}
          onRedFlagsChange={(v) => { dirtyRef.current = true; setRedFlags(v); }}
          interviewer={interviewer}
          onInterviewerChange={(v) => { dirtyRef.current = true; setInterviewer(v); }}
          readOnly={readOnly}
        />
        <DecisionPad
          score={score}
          depositTier={depositTier}
          onDepositTierChange={(t) => { dirtyRef.current = true; setDepositTier(t); }}
          readOnly={readOnly}
          currentStage={lead.stage}
          leadId={lead.id}
          steps={steps}
          statuses={statuses}
          history={history}
          onChanged={fetchDetail}
          stageNote={stageNote}
          onStageNoteChange={(v) => { dirtyRef.current = true; setStageNote(v); }}
          saveState={saveState}
        />
      </div>

      {!inCallStage && (
        <div className="card p-3 text-xs text-text-muted-2 italic">
          ⓘ Stage <span className="font-mono">{lead.stage}</span> — call belum dijadwalkan. Decision pad &amp; cockpit aktif setelah lead booking via Google Calendar (auto-advance ke <code className="font-mono">call_scheduled</code>).
        </div>
      )}

      {/* Mentor Matching — visible when stage = deposit_paid OR matched.
          Shown OUTSIDE the cockpit because it's a discrete action, not
          part of the call. */}
      {(lead.stage === "deposit_paid" || lead.stage === "matched") && (
        <section className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted-2">
            Mentor Matching
          </h2>
          <MentorMatchPanel lead={lead} onChanged={fetchDetail} />
        </section>
      )}

      {/* Phase 13.3: Catatan dari mentor moved into the ContextRail
          (left column, between Klasifikasi and Engagement) so admin
          sees mentor context inline during call review. */}

      {/* Pipeline Checklist now lives inside the DecisionPad (right
          column of the cockpit) so admin sees progress + branching in
          one place. The standalone collapsible card was removed
          post-Phase 11 to avoid duplication. */}

      {/* Collapsible: Outreach history */}
      <details className="card p-0 group/outreach">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground select-none">
          <span className="inline-flex items-center gap-2">
            <Icon name="mail" size={14} className="text-primary" />
            Outreach &amp; Engagement
          </span>
          <Icon
            name="chevron-right"
            size={14}
            className="text-text-muted-2 transition-transform group-open/outreach:rotate-90"
          />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60">
          <OutreachPanel
            lead={lead}
            outreach={outreach}
            onChanged={fetchDetail}
            variant="full"
          />
        </div>
      </details>

      {/* Collapsible: Stage timeline */}
      <details className="card p-0 group/timeline">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground select-none">
          <span className="inline-flex items-center gap-2">
            <Icon name="clock" size={14} className="text-primary" />
            Stage timeline ({history.length})
          </span>
          <Icon
            name="chevron-right"
            size={14}
            className="text-text-muted-2 transition-transform group-open/timeline:rotate-90"
          />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60">
          {history.length === 0 ? (
            <p className="text-xs text-text-muted">No transitions yet</p>
          ) : (
            <ol className="space-y-3 relative">
              {history.map((h, i) => (
                <li key={h.id} className="pl-5 relative">
                  <span
                    className={`absolute left-0 top-1 w-2 h-2 rounded-full ${
                      i === 0 ? "bg-primary" : "bg-text-muted-2"
                    }`}
                    aria-hidden
                  />
                  {i < history.length - 1 && (
                    <span className="absolute left-[3px] top-3 bottom-0 w-0.5 bg-border" aria-hidden />
                  )}
                  <div className="text-xs font-medium text-foreground">
                    {h.fromStage ? `${h.fromStage} → ${h.toStage}` : h.toStage}
                  </div>
                  <div className="text-[11px] text-text-muted-2">
                    {formatStamp(h.createdAt)} · {h.changedBy}
                  </div>
                  {h.note && (
                    <div className="text-[11px] text-text-muted mt-0.5 italic line-clamp-3">{h.note}</div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </div>
  );
}
