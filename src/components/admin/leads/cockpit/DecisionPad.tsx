"use client";

import Icon from "@/components/ui/Icon";
import { LEAD_DECISIONS, type LeadDecision } from "@/lib/leads/types";

/**
 * Right column of the Call Cockpit — the decision pad. Always-visible
 * scorecard + deposit tier + final decision picker + save buttons.
 *
 * Score → tier mapping (heuristic; admin can override).
 * Checklist max is 6 items:
 *   score >= 5 → Tier 1 (premium / siap)
 *   score >= 3 → Tier 2 (standard)
 *   else       → Tier 3 (coaching-heavy)
 *
 * Save flow:
 *   - "Simpan draft" → PATCH /call with markCompleted=false (does not
 *     advance stage; keeps the call_scheduled stage so admin can resume).
 *   - "Mark Completed" → PATCH /call with markCompleted=true (advances
 *     stage to call_completed + writes history).
 */

/**
 * Deposit tier — semua lead bayar deposit Rp 1jt yang sama, tier hanya
 * menentukan eligibility diskon program. Mapping default heuristic
 * (admin masih bisa override per lead via tier picker):
 *   score >= 5 → Tier 1 (applicable for discount)
 *   score >= 3 → Tier 2 (may be applicable)
 *   else       → Tier 3 (not applicable)
 */
const DEPOSIT_TIERS: Record<number, { label: string; eligibility: string; desc: string; eligibilityTone: "success" | "warn" | "muted" }> = {
  1: {
    label: "Tier 1 — Premium / siap",
    eligibility: "Applicable for discount",
    desc: "Lead matang. Layak dapet diskon penuh program.",
    eligibilityTone: "success",
  },
  2: {
    label: "Tier 2 — Standard",
    eligibility: "May be applicable",
    desc: "Mentee partial-ready. Diskon parsial atau case-by-case.",
    eligibilityTone: "warn",
  },
  3: {
    label: "Tier 3 — Coaching-heavy",
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

const DECISION_META: Record<LeadDecision, { label: string; desc: string; tone: "success" | "warn" | "muted" | "danger" }> = {
  proceed: {
    label: "Proceed — Tunggu konfirmasi deposit 1x24 jam",
    desc: "Kirim invoice & contract. Stage → deposit_pending (mentee punya 1×24 jam untuk respon).",
    tone: "success",
  },
  agree_to_pay: {
    label: "Agree to pay deposit",
    desc: "Mentee sudah commit langsung saat call — skip masa tunggu. Stage → deposit_agreed.",
    tone: "success",
  },
  waitlist: {
    label: "Waitlist — tahan dulu",
    desc: "Tidak fit timing / kapasitas. Reminder follow-up 1 minggu.",
    tone: "warn",
  },
  declined_by_student: {
    label: "Declined — mentee mundur",
    desc: "Catat alasan. Lead tetap di DB untuk re-engage.",
    tone: "muted",
  },
  rejected_by_us: {
    label: "Rejected — kita tolak",
    desc: "Red flags terlalu serius. Polite decline + archive.",
    tone: "danger",
  },
};

const TONE_COLORS: Record<"success" | "warn" | "muted" | "danger", { dot: string; border: string; bg: string }> = {
  success: { dot: "#10b981", border: "border-emerald-500", bg: "bg-emerald-50" },
  warn: { dot: "#d97706", border: "border-amber-500", bg: "bg-amber-50" },
  muted: { dot: "#94a3b8", border: "border-slate-400", bg: "bg-slate-50" },
  danger: { dot: "#dc2626", border: "border-rose-500", bg: "bg-rose-50" },
};

export function suggestDepositTier(score: number): number {
  // Thresholds calibrated against the 6-item readiness checklist.
  // Update both this and the comment block above if items change.
  if (score >= 5) return 1;
  if (score >= 3) return 2;
  return 3;
}

interface Props {
  score: number;       // 0-5
  decision: LeadDecision | "";
  onDecisionChange: (d: LeadDecision | "") => void;
  depositTier: number | null;
  onDepositTierChange: (t: number | null) => void;
  saving: boolean;
  completing: boolean;
  onSaveDraft: () => void;
  onMarkCompleted: () => void;
  errorMsg: string | null;
  okMsg: string | null;
  readOnly: boolean;
}

export default function DecisionPad({
  score,
  decision,
  onDecisionChange,
  depositTier,
  onDepositTierChange,
  saving,
  completing,
  onSaveDraft,
  onMarkCompleted,
  errorMsg,
  okMsg,
  readOnly,
}: Props) {
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

      {/* Deposit tier — semua lead bayar nominal sama; tier menentukan
          eligibility diskon program. Pesan deposit ditampilkan sekali
          di atas card group supaya tidak repetitif. */}
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
              <div className="text-[12.5px] font-semibold text-foreground">{t.label}</div>
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

      {/* Decision */}
      <div className="px-4 py-3.5 border-b border-border/60">
        <div className="text-[10.5px] font-bold text-text-muted-2 uppercase tracking-[0.06em] mb-2.5">
          Keputusan
        </div>
        <div className="space-y-1.5">
          {LEAD_DECISIONS.map((d) => {
            const meta = DECISION_META[d];
            const tone = TONE_COLORS[meta.tone];
            const active = decision === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDecisionChange(active ? "" : d)}
                disabled={readOnly}
                className={`w-full text-left p-2.5 rounded-lg border flex gap-2.5 items-start transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  active ? `${tone.border} ${tone.bg}` : "border-border bg-surface hover:bg-surface-elevated/40"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full border-[1.5px] mt-0.5 flex-shrink-0 inline-flex items-center justify-center`}
                  style={{
                    borderColor: active ? tone.dot : "var(--color-border, #d4d4d8)",
                    background: active ? tone.dot : "transparent",
                  }}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                <div>
                  <div className="text-[12.5px] font-semibold text-foreground">{meta.label}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{meta.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="mx-4 mt-2.5 mb-1 px-3 py-2 rounded-lg text-[11.5px] bg-danger-light border border-danger/30 text-danger">
          ⚠ {errorMsg}
        </div>
      )}
      {okMsg && (
        <div className="mx-4 mt-2.5 mb-1 px-3 py-2 rounded-lg text-[11.5px] bg-emerald-50 border border-emerald-200 text-emerald-800">
          {okMsg}
        </div>
      )}

      {/* Save */}
      {!readOnly && (
        <div className="px-4 py-3.5 border-t border-border bg-surface-elevated/30 mt-auto">
          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={saving || completing}
            className="w-full py-2.5 rounded-lg bg-primary text-white font-bold text-[13.5px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="check" size={14} />
            {completing ? "Menyimpan…" : "Simpan & Mark Completed"}
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving || completing}
            className="w-full py-2 mt-2 text-text-muted text-[12px] font-medium hover:text-foreground disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan draft saja"}
          </button>
        </div>
      )}
      {readOnly && (
        <div className="px-4 py-3 border-t border-border bg-surface-elevated/30 mt-auto text-[11.5px] text-text-muted-2 italic text-center">
          Locked — lead sudah di-match dengan mentor.
        </div>
      )}
    </aside>
  );
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
