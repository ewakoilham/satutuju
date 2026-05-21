"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type {
  LeadStepDefinition,
  LeadStepStatusRow,
  StepStatus,
} from "@/lib/leads/types";
import { formatJakartaStamp } from "@/lib/datetime-id";

interface Props {
  leadId: string;
  steps: LeadStepDefinition[];
  statuses: LeadStepStatusRow[];
  onChanged?: () => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  classified: "Lead classified",
  email_sent: "Email sent",
  email_opened: "Email opened",
  email_clicked: "Email clicked",
  whatsapp_sent: "WhatsApp sent",
  whatsapp_read: "WhatsApp read",
  call_scheduled: "Stage → call scheduled",
  deposit_pending: "Stage → deposit pending",
  deposit_agreed: "Stage → deposit agreed",
  deposit_paid: "Stage → deposit paid",
  matched: "Stage → matched",
};

/**
 * Subset of auto-triggers that correspond 1:1 to a LeadStage AND
 * should be admin-clickable from the checklist. Clicking such a step
 * hits /stage with the target stage, server auto-fires the step.
 *
 * Steps explicitly EXCLUDED from this list (still stage-mapped on the
 * server, just not clickable from the checklist):
 *   - call_scheduled — owned by Google Calendar booking flow. Admin
 *     should not be able to fake-advance "call scheduled" without a
 *     real calendar event. Stays read-only ("Auto · Stage → call
 *     scheduled" badge). The sync-from-calendar cron + manual stage
 *     dropdown still trigger the step normally.
 */
const STAGE_DRIVEN_TRIGGER: Record<string, string> = {
  deposit_pending: "deposit_pending",
  deposit_agreed:  "deposit_agreed",
  deposit_paid:    "deposit_paid",
  matched:         "matched",
};

const STAGE_PRETTY: Record<string, string> = {
  call_scheduled:  "Call Scheduled",
  deposit_pending: "Menunggu Konfirmasi Deposit",
  deposit_agreed:  "Bersedia Bayar",
  deposit_paid:    "Deposit Lunas",
  matched:         "Matched",
};

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  return formatJakartaStamp(iso);
}

/**
 * Per-lead pipeline checklist.
 *
 *   • Manual steps  → click box toggles done ↔ pending; right-click to skip.
 *   • Auto steps    → READ-ONLY. Driven entirely by system events
 *                     (email sent, deposit_pending stage transition, etc.).
 *                     Admin cannot manually check/uncheck them; doing so
 *                     causes data drift (a step says "done" while the
 *                     underlying stage hasn't moved).
 *
 * If admin needs to force a state, the right path is to advance the lead
 * STAGE (via /stage endpoint or Decision Pad on the detail page) — the
 * step auto-fires from there.
 */
export default function PipelineChecklist({ leadId, steps, statuses, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<LeadStepStatusRow[]>(statuses);

  const statusById = new Map<string, LeadStepStatusRow>();
  for (const s of localStatuses) statusById.set(s.stepId, s);

  async function setStatus(stepId: string, status: StepStatus, note?: string) {
    setBusy(stepId);
    try {
      const res = await fetch(`/api/new-leads/${leadId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, note: note ?? null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || `HTTP ${res.status}`);
        return;
      }
      const updated = (await res.json()).status as LeadStepStatusRow;
      setLocalStatuses((cur) => {
        const next = cur.slice();
        const idx = next.findIndex((s) => s.stepId === stepId);
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        return next;
      });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  /**
   * Advance the lead's stage to `nextStage`. The /stage endpoint writes
   * Lead.stage + LeadStageHistory + auto-fires the step whose
   * autoTrigger matches that stage (server-side STAGE_TO_STEP_TRIGGER
   * map). Refetches via onChanged so the parent sees fresh data.
   */
  async function advanceStage(stepId: string, nextStage: string) {
    setBusy(stepId);
    try {
      const res = await fetch(`/api/new-leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stage: nextStage,
          note: `Advanced via pipeline checklist (click step "${steps.find((s) => s.id === stepId)?.label ?? stepId}")`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || `HTTP ${res.status}`);
        return;
      }
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  if (steps.length === 0) {
    return (
      <div className="text-sm text-text-muted py-4 text-center">
        Belum ada step. Tambahkan di{" "}
        <a className="text-primary underline" href="/dashboard/admin/new-leads/pipeline">
          Pipeline Steps
        </a>
        .
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => {
        const s = statusById.get(step.id);
        const status = (s?.status ?? "pending") as StepStatus;
        const isAuto = Boolean(step.autoTrigger);
        const isDone = status === "done";
        const isSkipped = status === "skipped";
        const stamp = formatStamp(s?.completedAt ?? null);
        const completedBy = s?.completedBy === "system" ? "Sistem"
          : s?.completedBy === "system-backfill" ? "Sistem (backfill)"
          : s?.completedBy === "phase9-sync" ? "Sistem (Phase 9 sync)"
          : s?.completedBy ?? null;
        const isBusy = busy === step.id;
        const stageTarget = step.autoTrigger ? STAGE_DRIVEN_TRIGGER[step.autoTrigger] : null;
        // Stage-driven auto steps are clickable (when pending) to advance
        // the lead's stage. Event-driven auto steps (email/WA/classified)
        // remain truly read-only — there's no stage to advance to.
        const isClickableAuto = isAuto && !!stageTarget;

        const onClickBox = () => {
          if (isBusy) return;
          if (isDone) return; // no un-check from checklist; reverse via stage dropdown
          if (isAuto) {
            if (!stageTarget) return;
            const stageLabel = STAGE_PRETTY[stageTarget] ?? stageTarget;
            if (confirm(`Advance stage lead ke "${stageLabel}"? Step ini akan auto-check setelah stage berubah.`)) {
              void advanceStage(step.id, stageTarget);
            }
            return;
          }
          setStatus(step.id, "done");
        };

        // Right-click → skip. Manual only — auto steps controlled by
        // system events / stage transitions.
        const onContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          if (isBusy || isAuto) return;
          if (isSkipped) {
            setStatus(step.id, "pending");
            return;
          }
          const reason = prompt("Catatan skip (opsional)?") ?? "";
          setStatus(step.id, "skipped", reason || undefined);
        };

        const triggerLabel = step.autoTrigger
          ? TRIGGER_LABEL[step.autoTrigger] ?? step.autoTrigger
          : null;

        const checkboxTitle = isAuto
          ? isDone
            ? `Auto-completed — ${triggerLabel}. Untuk mundur, ubah stage lead lewat dropdown stage.`
            : isClickableAuto
              ? `Klik untuk advance stage ke "${STAGE_PRETTY[stageTarget!] ?? stageTarget}" (step auto-check setelah stage berubah).`
              : `Akan auto-complete saat event sistem: ${triggerLabel}`
          : isDone
            ? "Klik untuk uncheck (manual)"
            : "Klik untuk mark done (manual)";

        return (
          <li
            key={step.id}
            onContextMenu={onContextMenu}
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              isDone
                ? isAuto
                  ? "bg-primary-50/40 border-primary-200/70"
                  : "bg-emerald-50/60 border-emerald-200"
                : isSkipped
                  ? "bg-surface-elevated border-border opacity-70"
                  : isAuto
                    ? "bg-surface-elevated/40 border-border"
                    : "bg-surface border-border"
            }`}
          >
            <button
              type="button"
              onClick={onClickBox}
              disabled={isBusy || isDone || (isAuto && !isClickableAuto)}
              aria-label={checkboxTitle}
              title={checkboxTitle}
              className={`mt-0.5 flex-shrink-0 grid place-items-center w-5 h-5 rounded border-2 transition-colors ${
                isDone
                  ? "bg-primary border-primary text-white cursor-default"
                  : isSkipped
                    ? "bg-surface-elevated border-border text-text-muted-2"
                    : isAuto
                      ? isClickableAuto
                        ? "bg-white border-primary-200 hover:border-primary hover:bg-primary-50 cursor-pointer"
                        : "bg-surface-elevated border-border cursor-not-allowed"
                      : "bg-white border-gray-300 hover:border-primary cursor-pointer"
              }`}
            >
              {isDone && <Icon name="check" size={12} />}
              {isSkipped && <span className="text-[10px]">⨯</span>}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-mono text-text-muted-2">{step.order}</span>
                <span
                  className={`text-sm font-medium ${
                    isDone
                      ? "text-foreground"
                      : isSkipped
                        ? "text-text-muted line-through"
                        : "text-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {isAuto && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      isClickableAuto
                        ? "bg-blue-50 text-blue-700"
                        : "bg-primary-50 text-primary"
                    }`}
                    title={
                      isClickableAuto
                        ? `Manual: klik untuk advance stage ke "${STAGE_PRETTY[stageTarget!] ?? stageTarget}". Step akan auto-check setelah stage berubah.`
                        : `Auto-fires when system event: ${triggerLabel}. Cannot be toggled manually.`
                    }
                  >
                    <Icon name={isClickableAuto ? "arrow-right" : "lock"} size={9} />
                    {isClickableAuto
                      ? `Klik → ${STAGE_PRETTY[stageTarget!] ?? stageTarget}`
                      : `Auto · ${triggerLabel}`}
                  </span>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-text-muted mt-1">{step.description}</p>
              )}
              {stamp && (
                <p className="text-[11px] text-text-muted-2 mt-1">
                  {isDone ? "✓" : isSkipped ? "⨯ skipped" : ""} {completedBy ?? "—"} · {stamp}
                  {s?.note ? ` · ${s.note}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
      <li className="text-[11px] text-text-muted-2 italic pt-1 leading-relaxed">
        <strong>Auto · Stage</strong> (badge biru) — klik checkbox untuk advance
        stage lead ke posisi itu. Step auto-check setelah stage berubah.
        Tidak bisa un-check dari sini; mundurkan stage lewat dropdown stage.
        <br />
        <strong>Auto · Event</strong> (email/WA/classified) — terisi otomatis
        oleh event sistem (Resend / Fonnte / lead creation). Tidak clickable.
        <br />
        <strong>Manual step</strong> (tanpa badge) — klik untuk done/pending,
        klik kanan untuk skip.
      </li>
    </ul>
  );
}
