"use client";

/** Mentor UI for recurring weekly availability.
 *
 *  Renders as a card on the Schedule page (mentor only). Self-contained:
 *  fetches /api/availability, lets the mentor add / edit / toggle / delete
 *  weekly rules, and calls `onChanged` after any mutation so the parent
 *  calendar refetches and the freshly-generated slots appear.
 *
 *  Slot generation happens server-side in availability-cascade.ts; this
 *  component only manages the rules and surfaces the cascade summary.
 */

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-sm font-semibold font-[family-name:var(--font-heading)]">Recurring availability</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Set weekly hours once — slots are generated automatically for the next 8 weeks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          className="btn-primary text-xs py-1.5 px-3 shrink-0 inline-flex items-center gap-1"
        >
          <Icon name="plus" size={13} /> Add rule
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted-2 py-2">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-text-muted-2 py-2">
          No recurring rules yet. Add one and the next 8 weeks of slots are created automatically.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated ${r.active ? "" : "opacity-50"}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">
                  {DAYS[r.dayOfWeek]} · {r.startTime}–{r.endTime}
                </div>
                <div className="text-[11px] text-text-muted-2">
                  {r.recurMode === "fixed" ? `next ${r.weeksAhead} weeks` : "every week"}
                  {r.notes ? ` · ${r.notes}` : ""}
                </div>
              </div>
              <button
                type="button"
                title={r.active ? "Deactivate" : "Activate"}
                disabled={busyId === r.id}
                onClick={() => toggleActive(r)}
                className="text-[11px] font-semibold text-text-muted-2 hover:text-text-base px-1.5 py-0.5 rounded"
              >
                {r.active ? "On" : "Off"}
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
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                title="Delete"
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
        <p className="text-[11px] text-text-muted-2 mt-2">
          {summary.created > 0 && `+${summary.created} slots created`}
          {summary.removed > 0 && `${summary.created > 0 ? " · " : ""}${summary.removed} removed`}
          {summary.updated > 0 && `${summary.created > 0 || summary.removed > 0 ? " · " : ""}${summary.updated} updated`}
        </p>
      )}

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
    if (durMins <= 0) return "Start time must be before end time.";
    if (durMins < MIN_MINS) return "Minimum duration is 60 minutes.";
    if (durMins > MAX_MINS) return "Maximum duration is 90 minutes.";
    if (recurMode === "fixed" && (weeksAhead < 1 || weeksAhead > MAX_WEEKS))
      return `Weeks ahead must be 1–${MAX_WEEKS}.`;
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
        setErr(data.error || "Failed to save rule.");
        return;
      }
      onSaved(data.cascade);
    } catch {
      setErr("Failed to save rule.");
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
            {initial ? "Edit recurring rule" : "Recurring availability"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-elevated transition text-text-muted-2">
            <Icon name="x" size={16} />
          </button>
        </div>

        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Day</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="input-field w-full">
              {DAYS.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field w-full" />
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field w-full" />
            </div>
          </div>
          {durMins > 0 && (
            <p className={`text-[11px] font-medium text-right pr-0.5 -mt-1 ${durOk ? "text-blue-500" : "text-amber-500"}`}>
              {durMins} min · 60–90 min only
            </p>
          )}

          <div>
            <label className="text-xs text-text-muted font-medium block mb-1">Repeat</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRecurMode("unlimited")}
                className={`flex-1 text-sm py-2 ${recurMode === "unlimited" ? "btn-primary" : "btn-ghost"}`}
              >
                Every week
              </button>
              <button
                type="button"
                onClick={() => setRecurMode("fixed")}
                className={`flex-1 text-sm py-2 ${recurMode === "fixed" ? "btn-primary" : "btn-ghost"}`}
              >
                Limit
              </button>
            </div>
          </div>

          {recurMode === "fixed" && (
            <div>
              <label className="text-xs text-text-muted font-medium block mb-1">How many weeks ahead</label>
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
              Notes <span className="text-text-muted-2">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. via Google Meet"
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !durOk} className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">
            {saving ? "Saving…" : initial ? "Save" : "Add & create slots"}
          </button>
        </div>
      </div>
    </div>
  );
}
