"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import PipelineSubnav from "@/components/admin/leads/PipelineSubnav";
import {
  CATEGORY_META,
  STEP_AUTO_TRIGGERS,
  TRIGGER_CATEGORY,
  TRIGGER_LABEL,
  type LeadStepDefinition,
  type StepAutoTrigger,
  type StepAutoTriggerCategory,
} from "@/lib/leads/types";

interface StepsResponse {
  steps: LeadStepDefinition[];
}

/** Color classes per trigger category. Mirrors PipelineChecklist tones so
 *  admin sees the same badge color on both /pipeline and the lead detail. */
const BADGE_TONE_CLASS: Record<"violet" | "blue" | "emerald", string> = {
  violet:  "bg-violet-50 text-violet-700",
  blue:    "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
};

/** Display label for the trigger column. `null` (manual) gets the
 *  neutral "Manual" pill. */
function triggerDisplay(autoTrigger: StepAutoTrigger | null): {
  label: string;
  toneClass: string;
  iconName: string;
} {
  if (!autoTrigger) {
    return {
      label: "Manual",
      toneClass: "bg-surface-elevated text-text-muted-2",
      iconName: "hand",
    };
  }
  const category = TRIGGER_CATEGORY[autoTrigger];
  const meta = CATEGORY_META[category];
  return {
    label: `${meta.label} · ${TRIGGER_LABEL[autoTrigger]}`,
    toneClass: BADGE_TONE_CLASS[meta.tone],
    iconName: meta.iconName,
  };
}

/** Grouped trigger picker entries — used by both CreateStepModal and
 *  inline trigger picker. Manual entry is rendered separately. */
const TRIGGER_GROUPS: Array<{
  category: StepAutoTriggerCategory;
  triggers: StepAutoTrigger[];
}> = (() => {
  const groups: Record<StepAutoTriggerCategory, StepAutoTrigger[]> = {
    event:           [],
    "stage-click":   [],
    "stage-system":  [],
  };
  for (const t of STEP_AUTO_TRIGGERS) {
    groups[TRIGGER_CATEGORY[t]].push(t);
  }
  return [
    { category: "event" as const,         triggers: groups.event },
    { category: "stage-click" as const,   triggers: groups["stage-click"] },
    { category: "stage-system" as const,  triggers: groups["stage-system"] },
  ];
})();

export default function PipelineManagerPage() {
  const [steps, setSteps] = useState<LeadStepDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadStepDefinition | null>(null);

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

  // Active steps render in drag-orderable list; inactive steps go in a
  // collapsed section at the bottom (read-only, with reactivate toggle).
  const activeSteps = useMemo(() => steps.filter((s) => s.isActive), [steps]);
  const inactiveSteps = useMemo(() => steps.filter((s) => !s.isActive), [steps]);

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
      // Merge new ordering back into full steps array
      const reorderedIds = new Set(newSteps.map((s) => s.id));
      setSteps((cur) => {
        const others = cur.filter((s) => !reorderedIds.has(s.id));
        return [
          ...newSteps.map((s, i) => ({ ...s, order: i + 1 })),
          ...others,
        ];
      });
    }
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const sourceIdx = activeSteps.findIndex((s) => s.id === dragId);
    const targetIdx = activeSteps.findIndex((s) => s.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const next = activeSteps.slice();
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
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

  return (
    <div className="space-y-5">
      <PipelineSubnav />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Pipeline Steps
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Checklist yang dilewati setiap lead. Drag untuk reorder. Step ber-trigger
            otomatis selesai sesuai kategori di bawah.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Icon name="plus" size={14} /> Tambah step
          </button>
        </div>
      </div>

      {/* Category legend — explains the 3 badge tones used in the list */}
      <div className="card p-3 flex items-center gap-3 flex-wrap text-xs">
        <span className="font-semibold text-text-muted">Kategori trigger:</span>
        {(["event", "stage-click", "stage-system"] as const).map((cat) => {
          const meta = CATEGORY_META[cat];
          return (
            <span key={cat} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE_TONE_CLASS[meta.tone]}`}
              >
                <Icon name={meta.iconName} size={9} />
                {meta.label}
              </span>
              <span className="text-text-muted-2">{meta.desc}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-elevated text-text-muted-2">
            <Icon name="hand" size={9} />
            Manual
          </span>
          <span className="text-text-muted-2">Admin tick manual di checklist lead.</span>
        </span>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={5} /></div>
        ) : error ? (
          <div className="p-6 text-sm text-danger">Error: {error}</div>
        ) : activeSteps.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-muted">
            Belum ada step aktif. Klik &quot;Tambah step&quot; untuk mulai.
          </div>
        ) : (
          <ul>
            {activeSteps.map((step) => {
              const td = triggerDisplay(step.autoTrigger);
              return (
                <li
                  key={step.id}
                  draggable
                  onDragStart={() => setDragId(step.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(step.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`flex items-start gap-3 px-4 py-3 border-t border-border/60 first:border-t-0 transition-colors hover:bg-surface-elevated/40 ${
                    dragId === step.id ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className="text-text-muted-2 mt-1 cursor-grab active:cursor-grabbing select-none"
                    title="Drag untuk reorder"
                  >
                    <Icon name="menu" size={14} />
                  </div>
                  <div className="text-xs font-mono text-text-muted-2 mt-1 w-6">{step.order}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <input
                        type="text"
                        defaultValue={step.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== step.label) void patchStep(step.id, { label: v });
                        }}
                        className="font-medium text-foreground bg-transparent border-0 border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full max-w-md px-1"
                      />
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${td.toneClass}`}
                        title={
                          step.autoTrigger
                            ? CATEGORY_META[TRIGGER_CATEGORY[step.autoTrigger]].desc
                            : "Manual — admin tick di checklist lead"
                        }
                      >
                        <Icon name={td.iconName} size={9} />
                        {td.label}
                      </span>
                    </div>
                    {step.description && (
                      <div className="text-xs text-text-muted mt-1 line-clamp-2">{step.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      type="button"
                      onClick={() => void patchStep(step.id, { isActive: false })}
                      disabled={busy}
                      className="btn-ghost text-xs inline-flex items-center gap-1.5"
                      title="Nonaktifkan — riwayat tetap tersimpan"
                    >
                      <Icon name="eye-off" size={12} /> Nonaktifkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(step)}
                      className="text-danger hover:bg-danger-light p-1.5 rounded transition-colors"
                      aria-label="Hapus step"
                      disabled={busy}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Inactive steps — collapsed section, read-only display + reactivate */}
      {inactiveSteps.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-text-muted hover:bg-surface-elevated/40 transition-colors text-left"
          >
            <Icon name={showInactive ? "chevron-down" : "chevron-right"} size={14} />
            Step nonaktif ({inactiveSteps.length})
            <span className="text-xs text-text-muted-2 ml-1 font-normal">
              — riwayat preserved, tidak muncul di checklist lead baru
            </span>
          </button>
          {showInactive && (
            <ul className="border-t border-border/60">
              {inactiveSteps.map((step) => {
                const td = triggerDisplay(step.autoTrigger);
                return (
                  <li
                    key={step.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-t border-border/60 first:border-t-0 bg-surface-elevated/20 opacity-80"
                  >
                    <div className="text-xs font-mono text-text-muted-2 w-6">{step.order}</div>
                    <span className="text-sm text-text-muted line-through flex-1 truncate">{step.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${td.toneClass}`}
                    >
                      <Icon name={td.iconName} size={9} />
                      {td.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => void patchStep(step.id, { isActive: true })}
                      disabled={busy}
                      className="btn-ghost text-xs inline-flex items-center gap-1.5"
                    >
                      <Icon name="refresh" size={12} /> Aktifkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(step)}
                      className="text-danger hover:bg-danger-light p-1.5 rounded transition-colors"
                      aria-label="Hapus step"
                      disabled={busy}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {showCreate && (
        <CreateStepModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await fetchSteps();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteStepModal
          step={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => {
            setDeleteTarget(null);
            await fetchSteps();
          }}
          onDeactivated={async () => {
            await patchStep(deleteTarget.id, { isActive: false });
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Step delete modal — 2-tier:
 *   1. First-attempt DELETE returns 409 if step has history.
 *      Modal then offers "Nonaktifkan saja" (primary) + "Hapus permanen"
 *      (secondary, requires typing exact label).
 *   2. If history count == 0, simple confirm-and-delete.
 */
function DeleteStepModal({
  step,
  onClose,
  onDeleted,
  onDeactivated,
}: {
  step: LeadStepDefinition;
  onClose: () => void;
  onDeleted: () => void;
  onDeactivated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [historyCount, setHistoryCount] = useState<{ done: number; skipped: number } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [showForceUI, setShowForceUI] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Probe history counts on mount so the modal can decide whether to
  // show preserve/destroy options or a plain confirm.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/new-leads/steps/${step.id}?probe=true`, {
          method: "DELETE",
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setErr(body.error || `HTTP ${res.status}`);
          setChecked(true);
          return;
        }
        const body = await res.json().catch(() => ({}));
        setHistoryCount({
          done: body.doneCount ?? 0,
          skipped: body.skippedCount ?? 0,
        });
        setChecked(true);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Network error");
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  async function plainDelete() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/new-leads/steps/${step.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  async function forceDelete() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/new-leads/steps/${step.id}?force=true`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  const totalHistory = (historyCount?.done ?? 0) + (historyCount?.skipped ?? 0);
  const canForceDelete = confirmText === step.label && acknowledged;

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      size="md"
      title={
        !checked
          ? "Memeriksa riwayat…"
          : totalHistory > 0
            ? "Hapus step dengan riwayat?"
            : "Hapus step?"
      }
      actions={
        !checked ? (
          <button onClick={onClose} disabled={busy} className="btn-ghost">Batal</button>
        ) : err && !historyCount ? (
          <button onClick={onClose} disabled={busy} className="btn-ghost">Tutup</button>
        ) : totalHistory === 0 ? (
          <>
            <button onClick={onClose} disabled={busy} className="btn-ghost">Batal</button>
            <button
              onClick={plainDelete}
              disabled={busy}
              className="btn-primary bg-danger hover:bg-danger/90"
            >
              {busy ? "Menghapus…" : "Hapus"}
            </button>
          </>
        ) : !showForceUI ? (
          <>
            <button onClick={onClose} disabled={busy} className="btn-ghost">Batal</button>
            <button
              onClick={() => setShowForceUI(true)}
              disabled={busy}
              className="btn-ghost text-danger"
            >
              Hapus permanen…
            </button>
            <button onClick={onDeactivated} disabled={busy} className="btn-primary">
              Nonaktifkan saja
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setShowForceUI(false)} disabled={busy} className="btn-ghost">
              ← Kembali
            </button>
            <button
              onClick={forceDelete}
              disabled={busy || !canForceDelete}
              className="btn-primary bg-danger hover:bg-danger/90 disabled:opacity-40"
            >
              {busy ? "Menghapus…" : `Hapus ${totalHistory} riwayat permanen`}
            </button>
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        {!checked ? (
          <p className="text-text-muted">Menghitung riwayat status di leads…</p>
        ) : err && !historyCount ? (
          <div className="text-danger">Error: {err}</div>
        ) : totalHistory === 0 ? (
          <p>
            Step <strong>&quot;{step.label}&quot;</strong> belum punya riwayat status di lead manapun.
            Aman untuk dihapus permanen.
          </p>
        ) : !showForceUI ? (
          <>
            <p>
              Step <strong>&quot;{step.label}&quot;</strong> punya <strong>{totalHistory}</strong> riwayat
              status di leads ({historyCount?.done ?? 0} done · {historyCount?.skipped ?? 0} skipped).
            </p>
            <p className="text-xs text-text-muted">
              Menghapus permanen akan menghilangkan semua riwayat ini dari audit trail. Nonaktifkan
              saja jika ingin menyembunyikan step dari checklist baru tapi mempertahankan riwayat.
            </p>
          </>
        ) : (
          <>
            <p className="text-danger font-medium">
              ⚠ Hapus permanen akan menghilangkan <strong>{totalHistory}</strong> riwayat status di
              lead. Tidak bisa di-undo.
            </p>
            <div>
              <label className="text-xs uppercase tracking-wider text-text-muted-2 block mb-1">
                Ketik label step persis untuk konfirmasi
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={step.label}
                className="input-field text-sm font-mono"
                autoFocus
              />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="accent-danger mt-0.5"
              />
              <span className="text-xs">
                Saya paham riwayat status akan hilang dan tidak bisa dikembalikan.
              </span>
            </label>
            {err && <div className="text-sm text-danger">{err}</div>}
          </>
        )}
      </div>
    </Modal>
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
      description="Step baru otomatis muncul (pending) di semua lead existing."
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
            placeholder="mis. Verifikasi dokumen pendukung"
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
            <option value="">Manual (admin tick di checklist lead)</option>
            {TRIGGER_GROUPS.map((group) => (
              <optgroup key={group.category} label={CATEGORY_META[group.category].label}>
                {group.triggers.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-text-muted-2 mt-1">
            <strong>Event</strong>: Resend/Fonnte/classify → read-only di checklist.{" "}
            <strong>Klik</strong>: admin advance stage dari checklist.{" "}
            <strong>Calendar</strong>: Google Calendar booking, tidak bisa manual.
          </p>
        </div>
        {err && <div className="text-sm text-danger">{err}</div>}
      </div>
    </Modal>
  );
}
