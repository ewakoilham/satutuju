"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type {
  LeadStepDefinition,
  LeadStepStatusRow,
  StepStatus,
} from "@/lib/leads/types";

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
  call_scheduled: "Call scheduled",
  deposit_pending: "Stage → deposit pending",
  deposit_paid: "Stage → deposit paid",
  matched: "Mentor matched",
};

function formatStamp(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
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

        // Click handler. Auto steps are fully locked — no toggle in either
        // direction. Manual steps toggle done↔pending.
        const onClickBox = () => {
          if (isBusy) return;
          if (isAuto) return;
          setStatus(step.id, isDone ? "pending" : "done");
        };

        // Right-click → skip. Only applies to manual steps. Auto steps
        // can't be skipped — they fire when their trigger condition is
        // met, full stop.
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
            ? `Auto-completed — ${triggerLabel}`
            : `Akan auto-complete saat: ${triggerLabel}`
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
              disabled={isBusy || isAuto}
              aria-label={checkboxTitle}
              title={checkboxTitle}
              className={`mt-0.5 flex-shrink-0 grid place-items-center w-5 h-5 rounded border-2 transition-colors ${
                isDone
                  ? isAuto
                    ? "bg-primary border-primary text-white cursor-default"
                    : "bg-primary border-primary text-white cursor-pointer"
                  : isSkipped
                    ? "bg-surface-elevated border-border text-text-muted-2"
                    : isAuto
                      ? "bg-surface-elevated border-border cursor-not-allowed"
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
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-50 text-primary"
                    title={`Auto-fires when system event: ${triggerLabel}. Cannot be toggled manually.`}
                  >
                    <Icon name="lock" size={9} />
                    Auto · {triggerLabel}
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
        <strong>Auto step</strong> (
        <Icon name="lock" size={9} className="inline" /> badge) terisi otomatis
        dari event sistem — tidak bisa di-toggle manual. Untuk memaksa progress,
        advance <strong>stage</strong> lewat Decision Pad / stage transition.
        <br />
        <strong>Manual step</strong> (tanpa badge) klik untuk done/pending, klik
        kanan untuk skip.
      </li>
    </ul>
  );
}
