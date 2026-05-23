"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  LEAD_STAGES,
  STAGE_LABEL,
  STAGE_NOTE_PLACEHOLDER,
  STAGE_TO_STEP_TRIGGER,
  TRIGGER_CATEGORY,
  TRIGGER_HINT,
  decodeStageNote,
  type LeadStage,
  type LeadStageHistory,
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
  /** Lead's current stage. Required for backward-revert logic and
   *  inline-note placement (current-stage step gets the editable
   *  textarea; past stages show read-only history note). */
  currentStage: LeadStage;
  /** Stage transitions for this lead. Used to surface past notes
   *  (stored on LeadStageHistory.note) inline under each past stage's
   *  step button. */
  history: LeadStageHistory[];
  /** Current stage's note (Lead.stageNote). Bound to the inline
   *  textarea for whichever step button matches currentStage. */
  stageNote: string;
  onStageNoteChange: (v: string) => void;
}

/**
 * Map from a trigger back to the stage that owns it. Inverse of
 * STAGE_TO_STEP_TRIGGER. Built once on module load.
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
 * Latest note from history for transitions INTO the given stage.
 * The marker stripping is delegated to decodeStageNote() in types.ts —
 * keeps encode/decode paired in one place.
 */
function noteForPastStage(stage: LeadStage, history: LeadStageHistory[]): string | null {
  const matching = history
    .filter((h) => h.toStage === stage && h.note)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return matching?.note ? decodeStageNote(matching.note) : null;
}

/**
 * Per-lead pipeline checklist — Phase 11.1.
 *
 * Visible steps: only stage-click and manual. Event + stage-system
 * (Klasifikasi otomatis through Schedule initial call, plus Match
 * dengan mentor) are hidden — admin can't act on them anyway.
 *
 * Stage-click steps support BOTH forward and backward movement:
 *   • Click pending step → advance lead.stage to step's target
 *   • Click done step → revert lead.stage to the previous LEAD_STAGES
 *     index. Server side, /api/new-leads/[id]/stage resets the step
 *     statuses for stages now in the future so no drift.
 *
 * Each stage-click step exposes its per-stage note inline:
 *   • Current-stage step → editable textarea bound to Lead.stageNote
 *   • Past-stage step → read-only italic snippet from history
 *   • Future-stage step → nothing
 */
export default function PipelineChecklist({
  leadId,
  steps,
  statuses,
  onChanged,
  currentStage,
  history,
  stageNote,
  onStageNoteChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<LeadStepStatusRow[]>(statuses);
  useEffect(() => { setLocalStatuses(statuses); }, [statuses]);

  // Phase 11.2: which step has its inline advance-form open. The form
  // hosts a textarea so admin can capture context BEFORE the stage
  // change. Submit → confirm modal → advance + persist note.
  const [advancingStepId, setAdvancingStepId] = useState<string | null>(null);
  const [advanceNote, setAdvanceNote] = useState("");

  // Local note draft so typing in the current-stage editable textarea
  // stays responsive; sync from prop.
  const [noteDraft, setNoteDraft] = useState(stageNote);
  useEffect(() => { setNoteDraft(stageNote); }, [stageNote]);

  const statusById = new Map<string, LeadStepStatusRow>();
  for (const s of localStatuses) statusById.set(s.stepId, s);

  // Phase 11.1 — show only stage-click + manual. Event and
  // stage-system steps happen automatically and the admin can't act on
  // them, so they're clutter in this surface.
  const visibleSteps = useMemo(() => {
    return steps.filter((step) => {
      const trigger = step.autoTrigger as StepAutoTrigger | null;
      if (!trigger) return true;                              // manual
      return TRIGGER_CATEGORY[trigger] === "stage-click";    // only stage-click
    });
  }, [steps]);

  const curIdx = LEAD_STAGES.indexOf(currentStage);

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

  async function advanceStage(
    stepId: string,
    nextStage: LeadStage,
    direction: "forward" | "backward",
    incomingStageNote: string | null = null,
  ) {
    setBusy(stepId);
    try {
      const stepLabel = steps.find((s) => s.id === stepId)?.label ?? stepId;
      const note = direction === "forward"
        ? `Advanced via pipeline checklist (klik step "${stepLabel}")`
        : `Mundurkan via pipeline checklist (klik step "${stepLabel}")`;
      const res = await fetch(`/api/new-leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // stageNote: only the advance form (forward) supplies one; the
        // /stage route treats undefined as "leave Lead.stageNote alone
        // after capture" so the conditional spread is unnecessary.
        body: JSON.stringify({ stage: nextStage, note, stageNote: incomingStageNote }),
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

  function openAdvanceForm(stepId: string) {
    setAdvancingStepId(stepId);
    setAdvanceNote("");
  }
  function cancelAdvanceForm() {
    setAdvancingStepId(null);
    setAdvanceNote("");
  }
  async function submitAdvanceForm(stepId: string, stageTarget: LeadStage, stageTargetLabel: string) {
    if (!confirm(`Pindahkan stage ke "${stageTargetLabel}"? Catatan akan disimpan.`)) return;
    await advanceStage(stepId, stageTarget, "forward", advanceNote.trim() || null);
    setAdvancingStepId(null);
    setAdvanceNote("");
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

  if (visibleSteps.length === 0) {
    return (
      <div className="text-xs text-text-muted-2 py-3 text-center italic">
        Tidak ada step manual untuk lead ini.
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
        const stageTarget = trigger ? STAGE_FOR_TRIGGER[trigger] : null;
        const isStageClick = !!stageTarget; // all visible auto steps are stage-click
        const triggerHint = trigger ? TRIGGER_HINT[trigger] : null;
        const stageTargetLabel = stageTarget ? STAGE_LABEL[stageTarget] : null;

        // Determine note placement: editable for current-stage, read-only
        // historical snippet for past stages, nothing for future.
        const stageIdx = stageTarget ? LEAD_STAGES.indexOf(stageTarget) : -1;
        const isCurrentStage = stageTarget !== null && currentStage === stageTarget;
        const isPastStage = stageTarget !== null && curIdx > stageIdx;
        const historicalNote = isPastStage && stageTarget
          ? noteForPastStage(stageTarget, history)
          : null;

        // Backward revert target — the immediately-prior LEAD_STAGES index.
        const prevStage = stageTarget && stageIdx > 0 ? LEAD_STAGES[stageIdx - 1] : null;

        const onClickBox = () => {
          if (isBusy) return;
          if (isAuto) {
            if (!isStageClick || !stageTarget) return;
            if (isDone) {
              // Backward: revert to prev stage. Server resets step
              // statuses now-in-the-future so no drift.
              if (!prevStage) return;
              if (confirm(
                `Mundurkan lead dari "${stageTargetLabel}" → "${STAGE_LABEL[prevStage]}"? Step "${step.label}" akan reset ke pending.`,
              )) {
                void advanceStage(step.id, prevStage, "backward");
              }
              return;
            }
            // Phase 11.2: don't fire confirm immediately. Open the
            // inline form so admin can write a stage note first.
            openAdvanceForm(step.id);
            return;
          }
          // Manual step
          if (isDone) {
            setStatus(step.id, "pending");
            return;
          }
          setStatus(step.id, "done");
        };

        // Right-click → skip. Manual only.
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
            ? `Klik untuk mundurkan stage ke "${prevStage ? STAGE_LABEL[prevStage] : "—"}".`
            : `Klik untuk advance stage ke "${stageTargetLabel}" (step auto-check setelah stage berubah).`
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
              disabled={isBusy}
              aria-label={checkboxTitle}
              title={checkboxTitle}
              className={`mt-0.5 flex-shrink-0 grid place-items-center w-5 h-5 rounded border-2 transition-colors ${
                isDone
                  ? "bg-primary border-primary text-white hover:bg-primary/90 cursor-pointer"
                  : isSkipped
                    ? "bg-surface-elevated border-border text-text-muted-2"
                    : "bg-white border-primary-200 hover:border-primary hover:bg-primary-50 cursor-pointer"
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
                    title={isStageClick ? `Klik untuk advance stage ke "${stageTargetLabel}".` : undefined}
                  >
                    ({isDone ? "klik untuk mundurkan" : triggerHint})
                  </span>
                )}
              </div>
              {stamp && (
                <p className="text-[11px] text-text-muted-2 mt-1">
                  {isDone ? "✓" : isSkipped ? "⨯ skipped" : ""} {completedBy ?? "—"} · {stamp}
                  {s?.note ? ` · ${s.note}` : ""}
                </p>
              )}

              {/* Phase 11.2 — inline advance form. Opens when admin
                  clicks an empty stage-click checkbox; submit triggers
                  the confirm modal and the actual /stage advance. */}
              {advancingStepId === step.id && isStageClick && stageTarget && (
                <div className="mt-2 space-y-1.5 bg-primary-50/40 border border-primary-200/60 rounded-lg p-2.5">
                  <label className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.05em] block">
                    Catatan untuk stage {stageTargetLabel} (opsional)
                  </label>
                  <textarea
                    value={advanceNote}
                    onChange={(e) => setAdvanceNote(e.target.value)}
                    autoFocus
                    rows={3}
                    maxLength={2000}
                    placeholder={STAGE_NOTE_PLACEHOLDER[stageTarget] ?? "Catatan opsional untuk stage ini"}
                    className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelAdvanceForm}
                      disabled={isBusy}
                      className="btn-ghost text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitAdvanceForm(step.id, stageTarget, stageTargetLabel!)}
                      disabled={isBusy}
                      className="btn-primary text-xs inline-flex items-center gap-1"
                    >
                      <Icon name="check" size={11} /> Simpan &amp; lanjutkan
                    </button>
                  </div>
                </div>
              )}

              {/* Inline per-step note. Current → editable textarea.
                  Past → read-only italic snippet. Future → nothing. */}
              {isCurrentStage && (
                <div className="mt-2">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => {
                      if (noteDraft !== stageNote) onStageNoteChange(noteDraft);
                    }}
                    placeholder={STAGE_NOTE_PLACEHOLDER[currentStage] ?? `Catatan untuk stage "${STAGE_LABEL[currentStage]}"`}
                    rows={2}
                    className="w-full text-[12px] px-2.5 py-1.5 rounded-lg border border-border bg-surface focus:border-primary focus:outline-none resize-none"
                    maxLength={2000}
                  />
                  <p className="text-[10px] text-text-muted-2 italic mt-0.5 leading-snug">
                    Catatan untuk stage ini · auto-save · disimpan ke history saat stage berubah.
                  </p>
                </div>
              )}
              {!isCurrentStage && historicalNote && (
                <div
                  className="mt-2 text-[11.5px] italic text-text-muted leading-snug px-2.5 py-1.5 rounded-md bg-surface-elevated/40 border border-border/40 line-clamp-3"
                  title={historicalNote}
                >
                  <span className="not-italic font-semibold text-text-muted-2">Catatan: </span>
                  {historicalNote}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
