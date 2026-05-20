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
  email_sent: "Auto: email sent",
  email_opened: "Auto: email opened",
  email_clicked: "Auto: email clicked",
  deposit_paid: "Auto: deposit paid",
  matched: "Auto: matched",
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
 * Per-lead pipeline checklist. Click checkbox to toggle pending↔done.
 * Auto-trigger steps are locked (can only be completed by system events
 * — emailing, deposit_paid webhook, etc.). Right-click on a manual row
 * to mark skipped.
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
        const completedBy = s?.completedBy === "system" ? "Sistem" : s?.completedBy ?? null;
        const isBusy = busy === step.id;

        // Toggle behavior:
        // - Auto steps: click does nothing; system controls them. Allow
        //   admin to manually override via right-click ("force done").
        // - Manual steps: click toggles done ↔ pending.
        const onClickBox = () => {
          if (isBusy) return;
          if (isAuto && !isDone) {
            // No-op on auto pending — system will flip it.
            return;
          }
          setStatus(step.id, isDone ? "pending" : "done");
        };

        const onContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          if (isBusy) return;
          if (isSkipped) {
            setStatus(step.id, "pending");
            return;
          }
          const reason = prompt("Catatan skip (opsional)?") ?? "";
          setStatus(step.id, "skipped", reason || undefined);
        };

        return (
          <li
            key={step.id}
            onContextMenu={onContextMenu}
            className={`flex items-start gap-3 p-3 rounded-xl border ${
              isDone
                ? "bg-emerald-50/60 border-emerald-200"
                : isSkipped
                ? "bg-surface-elevated border-border opacity-70"
                : "bg-surface border-border"
            }`}
          >
            <button
              type="button"
              onClick={onClickBox}
              disabled={isBusy || (isAuto && !isDone)}
              aria-label={isDone ? "Mark pending" : "Mark done"}
              className={`mt-0.5 flex-shrink-0 grid place-items-center w-5 h-5 rounded border-2 transition-colors ${
                isDone
                  ? "bg-primary border-primary text-white"
                  : isSkipped
                  ? "bg-surface-elevated border-border text-text-muted-2"
                  : isAuto
                  ? "bg-surface-elevated border-border cursor-not-allowed"
                  : "bg-white border-gray-300 hover:border-primary cursor-pointer"
              }`}
              title={isAuto && !isDone ? "Akan auto-complete saat event sistem terjadi" : undefined}
            >
              {isDone && <Icon name="check" size={12} />}
              {isSkipped && <span className="text-[10px]">⨯</span>}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-mono text-text-muted-2">{step.order}</span>
                <span className={`text-sm font-medium ${isDone ? "text-foreground" : isSkipped ? "text-text-muted line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
                {step.autoTrigger && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-50 text-primary">
                    🔒 {TRIGGER_LABEL[step.autoTrigger] ?? step.autoTrigger}
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
      <li className="text-[11px] text-text-muted-2 italic pt-1">
        Tip: klik kanan baris untuk skip step. Auto-step ditandai 🔒 — diisi otomatis oleh sistem.
      </li>
    </ul>
  );
}
