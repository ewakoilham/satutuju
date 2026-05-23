"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import PipelineChecklist from "@/components/admin/leads/PipelineChecklist";
import {
  STAGE_LABEL,
  type LeadStage,
  type LeadStageHistory,
  type LeadStepDefinition,
  type LeadStepStatusRow,
} from "@/lib/leads/types";

/**
 * Right column of the Call Cockpit. Phase 11 redesign:
 *
 *   • No Save / Mark Completed buttons — score/tier/notes auto-save in
 *     parent on blur (debounced PATCH /call).
 *   • Pipeline checklist embedded — clicking a stage-click step advances
 *     stage + auto-ticks the step (single source of truth).
 *   • Terminal decisions = 2 buttons (Declined + Rejected). Waitlist
 *     graduated to a linear stage; use stage dropdown to enter waitlist.
 *   • Per-stage notes textarea visible for parking / pending stages
 *     (waitlist, deposit_pending, deposit_agreed, deposit_paid).
 *   • Terminal section hidden entirely once the lead is past the
 *     terminal-decision window (matched / declined / rejected) —
 *     reversal goes via stage dropdown.
 */

/**
 * Deposit tier bands — anchored to readiness checklist score (0–6).
 * Thresholds mirror `suggestDepositTier()` so admin sees the rule and
 * the score-band in one glance.
 */
const DEPOSIT_TIERS: Record<number, { label: string; band: string; eligibility: string; desc: string; eligibilityTone: "success" | "warn" | "muted" }> = {
  1: {
    label: "Tier 1 — Premium / siap",
    band: "5–6 ✓",
    eligibility: "Applicable for discount",
    desc: "Lead matang. Layak dapet diskon penuh program.",
    eligibilityTone: "success",
  },
  2: {
    label: "Tier 2 — Standard",
    band: "3–4 ✓",
    eligibility: "May be applicable",
    desc: "Mentee partial-ready. Diskon parsial atau case-by-case.",
    eligibilityTone: "warn",
  },
  3: {
    label: "Tier 3 — Coaching-heavy",
    band: "0–2 ✓",
    eligibility: "Not applicable for discount",
    desc: "Butuh banyak coaching. Full price program.",
    eligibilityTone: "muted",
  },
};

const DEPOSIT_AMOUNT_LABEL = "Deposit Rp 1jt";

const TIER_ELIGIBILITY_COLOR: Record<"success" | "warn" | "muted", string> = {
  success: "text-emerald-700 bg-emerald-50",
  warn:    "text-amber-800 bg-amber-50",
  muted:   "text-slate-600 bg-slate-100",
};

// Phase 11.2: Waitlist now has its own checklist button, so the
// standalone "Catatan stage" textarea in DecisionPad is gone — all
// per-stage notes are managed inline inside PipelineChecklist.

/**
 * Stages where the terminal-decisions section is meaningful. Past
 * these stages (matched / declined / rejected) the lead is already on
 * a terminal branch — hide the buttons; reversal is via stage dropdown.
 */
const STAGES_WITH_TERMINAL: ReadonlySet<LeadStage> = new Set<LeadStage>([
  "call_scheduled", "call_completed", "waitlist",
  "deposit_pending", "deposit_agreed", "deposit_paid",
]);

const TERMINAL_ACTIONS: Array<{
  targetStage: LeadStage;
  label: string;
  desc: string;
  iconName: string;
  toneClass: string;
  activeClass: string;
}> = [
  {
    targetStage: "declined",
    label: "Declined — mentee mundur",
    desc: "Catat alasan. Lead tetap di DB untuk re-engage.",
    iconName: "x",
    toneClass: "border-slate-200 hover:border-slate-400 hover:bg-slate-50/60",
    activeClass: "border-slate-400 bg-slate-50 text-slate-900",
  },
  {
    targetStage: "rejected",
    label: "Rejected — kita tolak",
    desc: "Red flags terlalu serius. Polite decline + archive.",
    iconName: "flag",
    toneClass: "border-rose-200 hover:border-rose-400 hover:bg-rose-50/60",
    activeClass: "border-rose-500 bg-rose-50 text-rose-900",
  },
];

export function suggestDepositTier(score: number): number {
  // Thresholds calibrated against the 6-item readiness checklist.
  if (score >= 5) return 1;
  if (score >= 3) return 2;
  return 3;
}

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  score: number;       // 0-6
  depositTier: number | null;
  onDepositTierChange: (t: number | null) => void;
  readOnly: boolean;
  currentStage: LeadStage;
  /** Pipeline data — embedded checklist replaces the legacy decision
   *  radio picker. Admin advances the lead by ticking checklist items
   *  (linear path) or clicking one of the terminal actions. */
  leadId: string;
  steps: LeadStepDefinition[];
  statuses: LeadStepStatusRow[];
  history: LeadStageHistory[];
  onChanged: () => void;
  /** Current stage's note (Lead.stageNote). Only persisted while lead
   *  sits in this stage; rolled over to LeadStageHistory on transition. */
  stageNote: string;
  onStageNoteChange: (v: string) => void;
  /** Auto-save indicator. Parent debounces /call PATCH and reports
   *  status back. */
  saveState: SaveState;
}

export default function DecisionPad({
  score,
  depositTier,
  onDepositTierChange,
  readOnly,
  currentStage,
  leadId,
  steps,
  statuses,
  history,
  onChanged,
  stageNote,
  onStageNoteChange,
  saveState,
}: Props) {
  const [terminalBusy, setTerminalBusy] = useState<LeadStage | null>(null);
  const [terminalErr, setTerminalErr] = useState<string | null>(null);

  async function advanceToTerminal(stage: LeadStage, label: string) {
    if (terminalBusy) return;
    const isActive = currentStage === stage;
    const targetStage: LeadStage = isActive ? "call_completed" : stage;
    const promptMsg = isActive
      ? `Mundurkan lead dari "${STAGE_LABEL[stage]}"? Stage akan kembali ke "${STAGE_LABEL.call_completed}".`
      : `Set stage lead ke "${STAGE_LABEL[stage]}"? Pilihan ini sifatnya terminal — gunakan dropdown stage kalau mau membalikkan nanti.`;
    if (!confirm(promptMsg)) return;
    setTerminalBusy(stage);
    setTerminalErr(null);
    try {
      const res = await fetch(`/api/new-leads/${leadId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stage: targetStage,
          note: isActive
            ? `Mundur dari ${label} → ${STAGE_LABEL.call_completed}`
            : `Keputusan terminal: ${label}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTerminalErr(body.error || `HTTP ${res.status}`);
        return;
      }
      onChanged();
    } finally {
      setTerminalBusy(null);
    }
  }

  const suggested = suggestDepositTier(score);
  const effective = depositTier ?? suggested;
  const scoreCopy = score === 6
    ? "Siap di-pair sekarang"
    : score >= 5
      ? "Sangat siap — dorong proceed"
      : score >= 3
        ? "Partial — butuh coaching"
        : score === 0
          ? "Belum ada data"
          : "Lemah — fokus build dasar";

  const showTerminal = STAGES_WITH_TERMINAL.has(currentStage);

  return (
    <aside className="w-[320px] flex-shrink-0 self-start bg-surface border border-border rounded-xl flex flex-col">
      {/* Score ring */}
      <div className="px-4 pt-4 pb-3.5 border-b border-border/60">
        <div className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.06em]">
          Readiness Score (live)
        </div>
        <div className="flex gap-4 items-center mt-2.5">
          <ScoreRing score={score} max={6} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-text-muted mb-1">{scoreCopy}</div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${i < score ? "bg-primary" : "bg-border/60"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deposit tier */}
      <div className="px-4 py-3.5 border-b border-border/60">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.06em]">
            Tier — eligibility diskon
          </div>
          <div className="text-[11px] font-semibold text-primary tabular-nums">
            {DEPOSIT_AMOUNT_LABEL}
          </div>
        </div>
        {[1, 2, 3].map((n) => {
          const t = DEPOSIT_TIERS[n];
          const isSugg = n === suggested;
          const isActive = n === effective;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onDepositTierChange(n)}
              disabled={readOnly}
              className={`relative w-full text-left mb-2 p-3 rounded-xl border-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive ? "border-primary bg-primary-50/60" : "border-border bg-surface hover:border-primary-200"
              }`}
            >
              {isSugg && (
                <span className="absolute -top-2 right-2.5 px-2 py-px text-[9.5px] font-bold uppercase tracking-[0.04em] rounded-full bg-primary text-white">
                  Auto-suggested
                </span>
              )}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[12.5px] font-semibold text-foreground">{t.label}</span>
                <span className="text-[10.5px] font-mono text-text-muted-2 tabular-nums">
                  {t.band}
                </span>
              </div>
              <div className="mt-1.5">
                <span
                  className={`inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${TIER_ELIGIBILITY_COLOR[t.eligibilityTone]}`}
                >
                  {t.eligibility}
                </span>
              </div>
              <div className="text-[11.5px] text-text-muted mt-1.5 leading-snug">{t.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Pipeline checklist — primary advancement surface. */}
      <div className="px-4 py-3.5 border-b border-border/60">
        <div className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.06em] mb-2.5">
          Pipeline checklist
        </div>
        <PipelineChecklist
          leadId={leadId}
          steps={steps}
          statuses={statuses}
          onChanged={onChanged}
          currentStage={currentStage}
          history={history}
          stageNote={stageNote}
          onStageNoteChange={onStageNoteChange}
        />
      </div>

      {/* Phase 11.2: per-stage notes are now entirely inline inside
          PipelineChecklist (each step button hosts its own note). The
          standalone DecisionPad note section was removed. */}

      {/* Keputusan terminal — Declined / Rejected only (waitlist is linear). */}
      {showTerminal && (
        <div className="px-4 py-3.5 border-b border-border/60">
          <div className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.06em] mb-2.5">
            Keputusan terminal
          </div>
          <div className="space-y-1.5">
            {TERMINAL_ACTIONS.map((t) => {
              const active = currentStage === t.targetStage;
              const busy = terminalBusy === t.targetStage;
              return (
                <button
                  key={t.targetStage}
                  type="button"
                  onClick={() => void advanceToTerminal(t.targetStage, t.label)}
                  disabled={readOnly || terminalBusy !== null}
                  title={active ? `Klik lagi untuk mundurkan ke "${STAGE_LABEL.call_completed}"` : undefined}
                  className={`w-full text-left p-2.5 rounded-lg border flex gap-2.5 items-start transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    active ? t.activeClass : `${t.toneClass} bg-surface`
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded grid place-items-center mt-0.5 flex-shrink-0 border ${
                      active ? "bg-current text-white border-transparent" : "border-border bg-surface"
                    }`}
                  >
                    {active ? (
                      <Icon name="check" size={10} />
                    ) : (
                      <Icon name={t.iconName} size={10} className="text-text-muted-2" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold flex items-center gap-2">
                      {t.label}
                      {busy && <span className="text-[10px] font-normal text-text-muted-2">…</span>}
                      {active && !busy && (
                        <span className="text-[10px] font-normal italic text-text-muted-2">
                          klik untuk mundurkan
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{t.desc}</div>
                  </div>
                </button>
              );
            })}
            {terminalErr && (
              <div className="text-[11px] text-danger px-2.5 py-1.5 rounded bg-danger-light border border-danger/30">
                {terminalErr}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer: save indicator + locked badge when readOnly */}
      {readOnly ? (
        <div className="px-4 py-3 border-t border-border bg-surface-elevated/30 mt-auto text-[11.5px] text-text-muted-2 italic text-center">
          Locked — lead sudah di-match dengan mentor.
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-border/60 bg-surface-elevated/30 mt-auto flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-muted-2">
            Stage saat ini: <span className="font-semibold text-foreground">{STAGE_LABEL[currentStage]}</span>
          </span>
          <SaveIndicator state={saveState} />
        </div>
      )}
    </aside>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return <span className="text-[10.5px] text-text-muted-2 italic">Menyimpan…</span>;
  }
  if (state === "saved") {
    return <span className="text-[10.5px] text-emerald-700 inline-flex items-center gap-1">
      <Icon name="check" size={9} /> Tersimpan
    </span>;
  }
  return <span className="text-[10.5px] text-danger">Gagal simpan</span>;
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (score / max) * c;
  return (
    <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke="currentColor"
          className="text-primary"
          strokeWidth="6"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ transition: "stroke-dashoffset 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-[family-name:var(--font-heading)]">
        <div className="text-[20px] font-extrabold text-foreground leading-none tabular-nums">
          {score}
        </div>
        <div className="text-[9px] text-text-muted-2 font-semibold">/ {max}</div>
      </div>
    </div>
  );
}
