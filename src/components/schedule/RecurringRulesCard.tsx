"use client";

/** Mentor-facing UI for recurring availability rules.
 *
 *  Lives in the schedule page side rail (replaces the old "segera" placeholder).
 *  Self-contained: fetches /api/availability, lets the mentor add / edit /
 *  toggle / delete weekly rules, and calls `onChanged` after any mutation so
 *  the parent calendar refetches and the freshly-generated slots appear.
 *
 *  The actual slot generation happens server-side in availability-cascade.ts;
 *  this component only manages the rules and surfaces the cascade summary.
 */

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MIN_MINS = 60;
const MAX_MINS = 90;
const MAX_WEEKS = 8;

export interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurMode: "unlimited" | "fixed";
  weeksAhead: number | null;
  active: boolean;
  notes: string | null;
}

interface CascadeSummary {
  created: number;
  updated: number;
  removed: number;
}

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function RecurringRulesCard({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CascadeSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/availability");
      const data = await res.json();
      if (res.ok) setRules(data.rules || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyCascade = useCallback(
    async (cascade?: CascadeSummary) => {
      if (cascade) setSummary(cascade);
      await load();
      await onChanged?.();
    },
    [load, onChanged],
  );

  async function toggleActive(rule: AvailabilityRule) {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/availability/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      });
      const data = await res.json();
      if (res.ok) await applyCascade(data.cascade);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: AvailabilityRule) {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/availability/${rule.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) await applyCascade(data.cascade);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="jadwal-side-card">
      <h3>Aturan ketersediaan rutin</h3>
      <div className="desc">Jam mingguan yang otomatis aktif. Atur sekali, slot otomatis muncul tiap minggu.</div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--text-muted-3)", padding: "8px 0" }}>Memuat…</div>
      ) : rules.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted-3)", padding: "8px 0", lineHeight: 1.5 }}>
          Belum ada aturan rutin. Tambah satu dan slot 8 minggu ke depan dibuat otomatis.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {rules.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 10,
                background: "var(--surface-elevated, rgba(0,0,0,0.03))",
                opacity: r.active ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-poppins)" }}>
                  {DAYS[r.dayOfWeek]} · {r.startTime}–{r.endTime}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted-2)" }}>
                  {r.recurMode === "fixed" ? `${r.weeksAhead} minggu ke depan` : "tiap minggu"}
                  {r.notes ? ` · ${r.notes}` : ""}
                </div>
              </div>
              <button
                type="button"
                title={r.active ? "Nonaktifkan" : "Aktifkan"}
                disabled={busyId === r.id}
                onClick={() => toggleActive(r)}
                style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted-2)", padding: "2px 6px", borderRadius: 6 }}
              >
                {r.active ? "Aktif" : "Off"}
              </button>
              <button
                type="button"
                title="Edit"
                disabled={busyId === r.id}
                onClick={() => {
                  setEditing(r);
                  setEditorOpen(true);
                }}
                className="text-text-muted-2 hover:text-text-base"
              >
                <Icon name="calendar" size={14} />
              </button>
              <button
                type="button"
                title="Hapus"
                disabled={busyId === r.id}
                onClick={() => remove(r)}
                className="text-text-muted-2 hover:text-red-500"
              >
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {summary && (summary.created > 0 || summary.removed > 0 || summary.updated > 0) && (
        <div style={{ fontSize: 11, color: "var(--text-muted-2)", marginTop: 8 }}>
          {summary.created > 0 && `+${summary.created} slot dibuat`}
          {summary.removed > 0 && `${summary.created > 0 ? " · " : ""}${summary.removed} slot dihapus`}
          {summary.updated > 0 && `${summary.created > 0 || summary.removed > 0 ? " · " : ""}${summary.updated} disesuaikan`}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary py-2 text-sm font-semibold text-primary transition hover:bg-brand-blue-soft font-[family-name:var(--font-heading)]"
      >
        <Icon name="plus" size={14} /> Tambah aturan
      </button>

      <RuleEditorModal
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={(cascade) => {
          setEditorOpen(false);
          applyCascade(cascade);
        }}
      />
    </div>
  );
}

/* ── Add / edit modal ─────────────────────────────────────────────── */

function RuleEditorModal({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: AvailabilityRule | null;
  onClose: () => void;
  onSaved: (cascade?: CascadeSummary) => void;
}) {
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [recurMode, setRecurMode] = useState<"unlimited" | "fixed">("unlimited");
  const [weeksAhead, setWeeksAhead] = useState(4);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setDayOfWeek(initial?.dayOfWeek ?? 1);
    setStartTime(initial?.startTime ?? "16:00");
    setEndTime(initial?.endTime ?? "17:00");
    setRecurMode(initial?.recurMode ?? "unlimited");
    setWeeksAhead(initial?.weeksAhead ?? 4);
    setNotes(initial?.notes ?? "");
    setErr("");
  }, [open, initial]);

  const durMins = startTime && endTime ? toMins(endTime) - toMins(startTime) : 0;
  const durOk = durMins >= MIN_MINS && durMins <= MAX_MINS;

  function clientValidate(): string | null {
    if (durMins <= 0) return "Jam mulai harus sebelum jam selesai.";
    if (durMins < MIN_MINS) return "Durasi minimal 60 menit.";
    if (durMins > MAX_MINS) return "Durasi maksimal 90 menit.";
    if (recurMode === "fixed" && (weeksAhead < 1 || weeksAhead > MAX_WEEKS))
      return `Batas minggu harus 1–${MAX_WEEKS}.`;
    return null;
  }

  async function save() {
    const issue = clientValidate();
    if (issue) {
      setErr(issue);
      return;
    }
    setSaving(true);
    setErr("");
    const payload = {
      dayOfWeek,
      startTime,
      endTime,
      recurMode,
      weeksAhead: recurMode === "fixed" ? weeksAhead : undefined,
      notes: notes.trim() || null,
    };
    try {
      const res = initial
        ? await fetch(`/api/availability/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Gagal menyimpan aturan.");
        return;
      }
      onSaved(data.cascade);
    } catch {
      setErr("Gagal menyimpan aturan.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-xl w-full max-w-sm p-5 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold font-[family-name:var(--font-heading)]">
            {initial ? "Edit aturan rutin" : "Aturan ketersediaan rutin"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-elevated transition text-text-muted-2">
            <Icon name="x" size={16} />
          </button>
        </div>

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Hari</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="input-field w-full"
            >
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">Mulai</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">Selesai</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field w-full" />
            </div>
          </div>
          {durMins > 0 && (
            <p className={`text-[11px] font-medium text-right pr-0.5 -mt-1 ${durOk ? "text-blue-500" : "text-amber-500"}`}>
              {durMins} menit · 60–90 menit saja
            </p>
          )}

          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Pengulangan</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecurMode("unlimited")}
                className={`flex-1 text-sm py-2 rounded-lg border transition ${
                  recurMode === "unlimited" ? "btn-primary" : "btn-ghost"
                }`}
              >
                Tiap minggu
              </button>
              <button
                type="button"
                onClick={() => setRecurMode("fixed")}
                className={`flex-1 text-sm py-2 rounded-lg border transition ${
                  recurMode === "fixed" ? "btn-primary" : "btn-ghost"
                }`}
              >
                Batasi
              </button>
            </div>
          </div>

          {recurMode === "fixed" && (
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">Berapa minggu ke depan</label>
              <input
                type="number"
                min={1}
                max={MAX_WEEKS}
                value={weeksAhead}
                onChange={(e) => setWeeksAhead(Number(e.target.value))}
                className="input-field w-full"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">
              Catatan <span className="text-text-muted-2">(opsional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="mis. via Google Meet"
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">
            Batal
          </button>
          <button onClick={save} disabled={saving || !durOk} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">
            {saving ? "Menyimpan…" : initial ? "Simpan" : "Tambah & buat slot"}
          </button>
        </div>
      </div>
    </div>
  );
}
