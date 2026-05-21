"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  STEP_AUTO_TRIGGERS,
  type LeadStepDefinition,
  type StepAutoTrigger,
} from "@/lib/leads/types";

interface StepsResponse {
  steps: LeadStepDefinition[];
}

const TRIGGER_LABEL: Record<StepAutoTrigger | "manual", string> = {
  manual: "Manual",
  classified: "Auto: lead classified",
  email_sent: "Auto: email sent",
  email_opened: "Auto: email opened",
  email_clicked: "Auto: email clicked",
  whatsapp_sent: "Auto: WhatsApp sent",
  whatsapp_read: "Auto: WhatsApp read",
  call_scheduled: "Auto: call scheduled",
  deposit_pending: "Auto: deposit pending",
  deposit_agreed: "Auto: bersedia bayar",
  deposit_paid: "Auto: deposit lunas",
  matched: "Auto: matched",
};

export default function PipelineManagerPage() {
  const [steps, setSteps] = useState<LeadStepDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/new-leads/steps", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as StepsResponse;
      setSteps(data.steps);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSteps();
  }, [fetchSteps]);

  async function saveReorder(newSteps: LeadStepDefinition[]) {
    setBusy(true);
    const res = await fetch("/api/new-leads/steps/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ orderedIds: newSteps.map((s) => s.id) }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || `HTTP ${res.status}`);
      await fetchSteps();
    } else {
      setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
    }
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const sourceIdx = steps.findIndex((s) => s.id === dragId);
    const targetIdx = steps.findIndex((s) => s.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const next = steps.slice();
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
    setSteps(next);
    void saveReorder(next);
    setDragId(null);
  }

  async function patchStep(id: string, body: Partial<LeadStepDefinition>) {
    setBusy(true);
    const res = await fetch(`/api/new-leads/steps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || `HTTP ${res.status}`);
    } else {
      await fetchSteps();
    }
  }

  async function deleteStep(id: string) {
    if (!confirm("Hapus step ini? Riwayat status di semua lead juga akan ikut hilang.")) return;
    setBusy(true);
    const res = await fetch(`/api/new-leads/steps/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || `HTTP ${res.status}`);
    } else {
      await fetchSteps();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Pipeline Steps
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Define the checklist every lead progresses through. Drag to reorder. Steps marked &quot;Auto&quot; complete themselves when the corresponding system event fires.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin/new-leads" className="btn-ghost text-sm inline-flex items-center gap-1.5">
            <Icon name="chevron-left" size={14} /> Back to leads
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Icon name="plus" size={14} /> Tambah step
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={5} /></div>
        ) : error ? (
          <div className="p-6 text-sm text-danger">Error: {error}</div>
        ) : steps.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-muted">
            Belum ada step. Klik &quot;Tambah step&quot; untuk mulai.
          </div>
        ) : (
          <ul>
            {steps.map((step) => (
              <li
                key={step.id}
                draggable
                onDragStart={() => setDragId(step.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(step.id)}
                onDragEnd={() => setDragId(null)}
                className={`flex items-start gap-3 px-4 py-3 border-t border-border/60 first:border-t-0 transition-colors ${
                  dragId === step.id ? "opacity-40" : ""
                } ${!step.isActive ? "bg-surface-elevated/30" : "hover:bg-surface-elevated/40"}`}
              >
                <div
                  className="text-text-muted-2 mt-1 cursor-grab active:cursor-grabbing select-none"
                  title="Drag untuk reorder"
                >
                  <Icon name="menu" size={14} />
                </div>
                <div className="text-xs font-mono text-text-muted-2 mt-1 w-6">{step.order}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      defaultValue={step.label}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== step.label) void patchStep(step.id, { label: v });
                      }}
                      className="font-medium text-foreground bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full max-w-md px-1"
                    />
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-50 text-primary whitespace-nowrap">
                      {TRIGGER_LABEL[step.autoTrigger ?? "manual"]}
                    </span>
                  </div>
                  {step.description && (
                    <div className="text-xs text-text-muted mt-1 line-clamp-2">{step.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.isActive}
                      onChange={(e) => void patchStep(step.id, { isActive: e.target.checked })}
                      className="cursor-pointer"
                    />
                    {step.isActive ? "Active" : "Inactive"}
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteStep(step.id)}
                    className="text-danger hover:bg-danger-light p-1.5 rounded transition-colors"
                    aria-label="Hapus step"
                    disabled={busy}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <CreateStepModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await fetchSteps();
          }}
        />
      )}
    </div>
  );
}

function CreateStepModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [autoTrigger, setAutoTrigger] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!label.trim()) {
      setErr("Label wajib diisi");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/new-leads/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        label: label.trim(),
        description: description.trim() || null,
        autoTrigger: autoTrigger || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || `HTTP ${res.status}`);
      return;
    }
    onCreated();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Tambah pipeline step"
      description="Step baru akan otomatis muncul (pending) di semua lead existing."
      actions={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={submit} className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Tambah step"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Label *</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Verifikasi dokumen pendukung"
            className="input-field"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Deskripsi (opsional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Penjelasan singkat untuk admin lain"
            className="input-field min-h-[60px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Auto-trigger</label>
          <select
            value={autoTrigger}
            onChange={(e) => setAutoTrigger(e.target.value)}
            className="input-field"
          >
            <option value="">Manual (admin checks off)</option>
            {STEP_AUTO_TRIGGERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <p className="text-xs text-text-muted-2 mt-1">
            Jika dipilih, step akan otomatis selesai saat event sistem terjadi (mis. email_sent).
          </p>
        </div>
        {err && <div className="text-sm text-danger">{err}</div>}
      </div>
    </Modal>
  );
}
