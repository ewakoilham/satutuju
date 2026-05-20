"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  LEAD_DECISIONS,
  type Lead,
  type LeadDecision,
} from "@/lib/leads/types";

interface Props {
  lead: Lead;
  onChanged: () => void;
}

/**
 * Call Panel — visible on lead detail page when stage is at
 * call_scheduled or later. Captures the post-interview data:
 *   - 5-item readiness checklist (drives readinessScore 0-5)
 *   - Notes textarea (markdown OK)
 *   - Red flags textarea
 *   - Decision dropdown (proceed/waitlist/declined/rejected)
 *   - Auto-suggested deposit tier from readiness score
 *   - Assigned interviewer
 *
 * "Mark as Call Completed" advances stage call_scheduled → call_completed
 * AND persists all the fields above in one PATCH.
 */

const READINESS_ITEMS = [
  "Sudah punya skor IELTS / equivalent (atau plan-nya jelas)",
  "Sudah ada 3+ kampus shortlist + program-nya",
  "Funding plan jelas (LPDP / self-funded / partial)",
  "Timeline aplikasi realistis (intake target, deadline-aware)",
  "Motivasi essay sudah ada draft / outline",
] as const;

const DECISION_LABEL: Record<LeadDecision, string> = {
  proceed: "Proceed — book deposit",
  waitlist: "Waitlist — kita tahan dulu",
  declined_by_student: "Declined — mentee mundur",
  rejected_by_us: "Rejected — kita tolak",
};

/** Heuristic auto-suggest deposit tier from readiness score. */
function suggestDepositTier(score: number): number | null {
  if (score >= 4) return 1; // ready → premium tier
  if (score >= 2) return 2; // partial → standard
  if (score >= 0) return 3; // weak → entry / coaching-heavy
  return null;
}

export default function CallPanel({ lead, onChanged }: Props) {
  // Initialize from lead state. Readiness checkboxes derive from the
  // saved 0-5 score: index i is checked if i < readinessScore.
  const initialScore = lead.readinessScore ?? 0;
  const [readiness, setReadiness] = useState<boolean[]>(
    Array.from({ length: READINESS_ITEMS.length }, (_, i) => i < initialScore),
  );
  const [callNotes, setCallNotes] = useState(lead.callNotes ?? "");
  const [redFlags, setRedFlags] = useState(lead.redFlags ?? "");
  const [decision, setDecision] = useState<LeadDecision | "">((lead.decision as LeadDecision) ?? "");
  const [interviewer, setInterviewer] = useState(lead.assignedInterviewer ?? "");
  const [overrideDepositTier, setOverrideDepositTier] = useState<number | null>(lead.depositTier);

  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const score = readiness.filter(Boolean).length;
  const suggestedTier = suggestDepositTier(score);
  const effectiveTier = overrideDepositTier !== null ? overrideDepositTier : suggestedTier;

  function toggleReadiness(i: number) {
    setReadiness((r) => r.map((v, idx) => (idx === i ? !v : v)));
  }

  async function save(markCompleted: boolean) {
    if (markCompleted) setCompleting(true);
    else setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/new-leads/${lead.id}/call`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readinessScore: score,
          callNotes: callNotes.trim() || null,
          redFlags: redFlags.trim() || null,
          decision: decision || null,
          depositTier: effectiveTier,
          assignedInterviewer: interviewer.trim() || null,
          markCompleted,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || `HTTP ${res.status}`);
        return;
      }
      setOkMsg(markCompleted ? "Call marked as completed ✓" : "Saved ✓");
      onChanged();
      setTimeout(() => setOkMsg(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
      setCompleting(false);
    }
  }

  // Hide for leads still in earlier stages — the panel is contextually
  // irrelevant until the call has been scheduled.
  const visible =
    lead.stage === "call_scheduled" ||
    lead.stage === "call_completed" ||
    lead.stage === "deposit_pending" ||
    lead.stage === "deposit_paid" ||
    lead.stage === "matched";
  if (!visible) return null;

  const readOnly = lead.stage === "matched"; // freeze after mentor matched

  return (
    <div className="space-y-4">
      {/* Header with schedule info if available */}
      {lead.callScheduledAt && (
        <div className="text-xs text-text-muted-2 flex items-center gap-2">
          <Icon name="calendar" size={12} />
          Scheduled: {new Date(lead.callScheduledAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
        </div>
      )}

      {/* Interviewer */}
      <div className="space-y-1 max-w-md">
        <label className="text-xs uppercase tracking-wider text-text-muted-2">Interviewer</label>
        <input
          type="text"
          value={interviewer}
          onChange={(e) => setInterviewer(e.target.value)}
          disabled={readOnly}
          placeholder="mis. Razak, Venzo, ..."
          className="input-field text-sm"
        />
      </div>

      {/* Readiness checklist */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Readiness</label>
          <span className="text-xs font-semibold text-foreground">
            Score: {score} / 5
          </span>
        </div>
        <ul className="space-y-1.5">
          {READINESS_ITEMS.map((label, i) => (
            <li key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`readiness-${i}`}
                checked={readiness[i]}
                onChange={() => toggleReadiness(i)}
                disabled={readOnly}
                className="accent-primary mt-0.5"
              />
              <label htmlFor={`readiness-${i}`} className="text-sm text-foreground cursor-pointer flex-1">
                {label}
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-text-muted-2">Catatan call</label>
        <textarea
          value={callNotes}
          onChange={(e) => setCallNotes(e.target.value)}
          disabled={readOnly}
          rows={4}
          placeholder="Poin penting dari wawancara, kekuatan + concerns…"
          className="input-field text-sm font-mono leading-relaxed"
        />
      </div>

      {/* Red flags */}
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-text-muted-2">Red flags (opsional)</label>
        <textarea
          value={redFlags}
          onChange={(e) => setRedFlags(e.target.value)}
          disabled={readOnly}
          rows={2}
          placeholder="Concerns yang perlu di-flag untuk admin lain"
          className="input-field text-sm font-mono leading-relaxed"
        />
      </div>

      {/* Decision + deposit tier */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Decision</label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as LeadDecision | "")}
            disabled={readOnly}
            className="input-field text-sm"
          >
            <option value="">— belum diputuskan —</option>
            {LEAD_DECISIONS.map((d) => (
              <option key={d} value={d}>{DECISION_LABEL[d]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">
            Deposit tier
            {suggestedTier !== null && overrideDepositTier === null && (
              <span className="text-text-muted-2 normal-case ml-1">
                (auto: tier {suggestedTier})
              </span>
            )}
          </label>
          <select
            value={effectiveTier ?? ""}
            onChange={(e) => setOverrideDepositTier(e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={readOnly}
            className="input-field text-sm"
          >
            <option value="">— auto-suggest dari readiness —</option>
            <option value="1">Tier 1 (premium / siap)</option>
            <option value="2">Tier 2 (standard)</option>
            <option value="3">Tier 3 (coaching-heavy)</option>
          </select>
        </div>
      </div>

      {err && (
        <div className="text-xs px-3 py-2 rounded bg-danger-light border border-danger/30 text-danger">
          ⚠ {err}
        </div>
      )}
      {okMsg && (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
          {okMsg}
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={saving || completing}
            className="btn-ghost text-xs"
          >
            {saving ? "Saving…" : "Simpan saja"}
          </button>
          {lead.stage === "call_scheduled" && (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving || completing}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Icon name="check" size={12} />
              {completing ? "Saving…" : "Save + Mark Call Completed"}
            </button>
          )}
        </div>
      )}
      {readOnly && (
        <p className="text-xs text-text-muted-2 italic pt-3 border-t border-border/60">
          Locked — lead sudah di-match dengan mentor.
        </p>
      )}
    </div>
  );
}
