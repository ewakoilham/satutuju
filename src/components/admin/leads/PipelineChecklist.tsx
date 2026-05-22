"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  LEAD_STAGES,
  STAGE_LABEL,
  STAGE_TO_STEP_TRIGGER,
  TRIGGER_CATEGORY,
  TRIGGER_HINT,
  type LeadStage,
  type LeadStepDefinition,
  type LeadStepStatusRow,
  type StepAutoTrigger,
  type StepStatus,
} from "@/lib/leads/types";
import { formatJakartaStamp } from "@/lib/datetime-id";

interface Props {
  leadId: string;
  steps: LeadStepDefinition[];
  statuses: LeadStepStatusRow[];
  onChanged?: () => void;
  /** When provided, the checklist filters out auto (event +
   *  stage-system) steps that represent stages the lead has already
   *  passed — so admin only sees the steps that are still actionable.
   *  Manual + stage-click steps always remain visible. */
  currentStage?: LeadStage;
}

/**
 * For each auto trigger, the LEAD_STAGE the step represents. Used to
 * prune the checklist as the lead advances: once the lead's stage is
 * at-or-past this stage, the auto step is no longer actionable and
 * gets filtered out.
 *
 * `classified` maps to "new" because every lead in the system has
 * already passed classification by the time it's visible at all.
 */
const STAGE_FOR_AUTO_TRIGGER: Partial<Record<StepAutoTrigger, LeadStage>> = {
  classified:      "new",
  email_sent:      "outreach_sent",
  email_opened:    "email_opened",
  email_clicked:   "email_clicked",
  whatsapp_sent:   "outreach_sent",
  whatsapp_read:   "whatsapp_read",
  call_scheduled:  "call_scheduled",
  matched:         "matched",
};

const STAGE_INDEX: Record<LeadStage, number> = (() => {
  const out = {} as Record<LeadStage, number>;
  LEAD_STAGES.forEach((s, i) => { out[s] = i; });
  return out;
})();

/**
 * Map from a trigger back to the stage that owns it. Inverse of
 * STAGE_TO_STEP_TRIGGER. Built once on module load so per-step click
 * handlers can resolve "what stage should I advance to?" without
 * walking the map every render.
 */
const STAGE_FOR_TRIGGER: Partial<Record<StepAutoTrigger, LeadStage>> = (() => {
  const out: Partial<Record<StepAutoTrigger, LeadStage>> = {};
  for (const [stage, trigger] of Object.entries(STAGE_TO_STEP_TRIGGER)) {
    if (trigger) out[trigger] = stage as LeadStage;
  }
  return out;
})();

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
export default function PipelineChecklist({ leadId, steps, statuses, onChanged, currentStage }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<LeadStepStatusRow[]>(statuses);

  const statusById = new Map<string, LeadStepStatusRow>();
  for (const s of localStatuses) statusById.set(s.stepId, s);

  // Filter visible steps: hide auto (event + stage-system) steps that
  // represent stages the lead has already moved past. Manual and
  // stage-click steps always stay visible — they're admin's primary
  // action surface and may still need to be clicked retroactively.
  // When currentStage is undefined (e.g. consumer didn't pass it),
  // show everything (legacy behavior).
  const visibleSteps = useMemo(() => {
    if (!currentStage) return steps;
    const curIdx = STAGE_INDEX[currentStage] ?? -1;
    return steps.filter((step) => {
      const trigger = step.autoTrigger as StepAutoTrigger | null;
      if (!trigger) return true;                          // manual — keep
      const category = TRIGGER_CATEGORY[trigger];
      if (category === "stage-click") return true;        // admin's primary action surface
      const repStage = STAGE_FOR_AUTO_TRIGGER[trigger];
      if (!repStage) return true;                         // no mapping → keep
      const repIdx = STAGE_INDEX[repStage];
      return curIdx < repIdx;                             // hide if lead is at-or-past
    });
  }, [steps, currentStage]);

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

  // All steps filtered out by stage progression — say so explicitly
  // rather than show an empty card, so admin knows it isn't broken.
  if (visibleSteps.length === 0) {
    return (
      <div className="text-xs text-text-muted-2 py-3 text-center italic">
        Semua step otomatis sudah lewat untuk stage ini — tunggu admin actions berikutnya
        (atau gunakan keputusan terminal di bawah).
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {visibleSteps.map((step) => {
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
        const trigger = step.autoTrigger as StepAutoTrigger | null;
        const category = trigger ? TRIGGER_CATEGORY[trigger] : null;
        const stageTarget = trigger ? STAGE_FOR_TRIGGER[trigger] : null;
        // Stage-click triggers are clickable from the checklist. Event-
        // driven AND stage-system (calendar) triggers stay read-only.
        const isClickableAuto = category === "stage-click" && !!stageTarget;
        const triggerHint = trigger ? TRIGGER_HINT[trigger] : null;
        const stageTargetLabel = stageTarget ? STAGE_LABEL[stageTarget] : null;

        const onClickBox = () => {
          if (isBusy) return;
          if (isDone) return; // no un-check from checklist; reverse via stage dropdown
          if (isAuto) {
            if (!isClickableAuto || !stageTarget) return;
            if (
              confirm(
                `Advance stage lead ke "${stageTargetLabel}"? Step ini akan auto-check setelah stage berubah.`,
              )
            ) {
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

        const checkboxTitle = isAuto
          ? isDone
            ? `Auto-completed (${triggerHint}). Untuk mundur, ubah stage lead lewat dropdown stage.`
            : isClickableAuto
              ? `Klik untuk advance stage ke "${stageTargetLabel}" (step auto-check setelah stage berubah).`
              : `Akan auto-complete: ${triggerHint}`
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
                    isSkipped ? "text-text-muted line-through" : "text-foreground"
                  }`}
                >
                  {step.label}
                </span>
                {triggerHint && (
                  <span
                    className="text-[11px] text-text-muted-2 italic"
                    title={
                      isClickableAuto
                        ? `Klik untuk advance stage ke "${stageTargetLabel}".`
                        : undefined
                    }
                  >
                    ({triggerHint})
                  </span>
                )}
              </div>
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
    </ul>
  );
}
