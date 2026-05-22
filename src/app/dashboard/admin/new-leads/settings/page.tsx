"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { formatJakartaDateTime } from "@/lib/datetime-id";
import PipelineSubnav from "@/components/admin/leads/PipelineSubnav";

interface Settings {
  id: string;
  enabled: boolean;
  delayMinutes: number;
  lastRunAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Auto-send scheduler — gate the leads-auto-outreach cron. When
 * `enabled` is true, the cron (running every 5 min) sends the
 * bucket-appropriate template to leads matching:
 *   stage = "new"
 *   AND outreachSentAt IS NULL
 *   AND bucket has a template (not "unclassified")
 *   AND createdAt < now() - delayMinutes
 */
export default function AutoSendSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Form state (separate from settings so user can edit before saving).
  const [enabled, setEnabled] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(60);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/new-leads/auto-send-settings", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as Settings;
      setSettings(json);
      setEnabled(json.enabled);
      setDelayMinutes(json.delayMinutes);
      setErr(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSettings();
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/new-leads/auto-send-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, delayMinutes }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || `HTTP ${res.status}`);
        return;
      }
      setSettings(json);
      setOkMsg(`Tersimpan. Auto-send ${json.enabled ? "ENABLED" : "DISABLED"}, delay ${json.delayMinutes} menit.`);
      setTimeout(() => setOkMsg(null), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  const dirty = settings && (settings.enabled !== enabled || settings.delayMinutes !== delayMinutes);

  return (
    <div className="space-y-5">
      <PipelineSubnav />
      <div>
        <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
          Auto-Send Scheduler
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Otomatis kirim outreach ke lead baru yang sudah classified, setelah delay yang kamu set.
        </p>
      </div>

      <div className="card p-5 space-y-4 max-w-xl">
        {loading ? (
          <div className="h-32 bg-surface-elevated/40 rounded animate-pulse" />
        ) : (
          <>
            {/* Enable toggle */}
            <div className="flex items-start gap-3">
              <label className="flex items-center cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
              </label>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">
                  Aktifkan auto-send outreach
                </div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Saat aktif, cron (jalan tiap 5 menit) akan kirim email outreach otomatis ke lead baru
                  yang sudah lewat delay + punya bucket dengan template.
                </p>
              </div>
            </div>

            {/* Delay input */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-text-muted-2">
                Delay setelah lead masuk (menit)
              </label>
              <input
                type="number"
                min={5}
                max={10080}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10) || 0)}
                className="input-field text-sm w-40"
              />
              <p className="text-[11px] text-text-muted-2">
                Min 5 menit (= cron interval), max 10080 (1 minggu). Default 60 menit = 1 jam.
              </p>
            </div>

            {/* Status */}
            {settings && (
              <div className="text-xs text-text-muted-2 pt-3 border-t border-border/60 space-y-1">
                <div>
                  Status saat ini: <strong className={settings.enabled ? "text-emerald-700" : "text-text-muted"}>
                    {settings.enabled ? "ENABLED" : "DISABLED"}
                  </strong>
                </div>
                <div>
                  Last cron run: {settings.lastRunAt ? formatJakartaDateTime(settings.lastRunAt) : "belum pernah"}
                </div>
              </div>
            )}

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

            <div className="pt-2 border-t border-border/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
              {dirty && !saving && (
                <button
                  type="button"
                  onClick={() => {
                    if (!settings) return;
                    setEnabled(settings.enabled);
                    setDelayMinutes(settings.delayMinutes);
                  }}
                  className="btn-ghost text-xs"
                >
                  Reset
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Help */}
      <details className="card p-0 group/help max-w-xl">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Icon name="lightbulb" size={14} className="text-primary" />
            Cara kerja auto-send
          </span>
          <Icon name="chevron-right" size={14} className="text-text-muted-2 transition-transform group-open/help:rotate-90" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60 text-xs text-text-muted space-y-2">
          <p><strong>Qualifying lead:</strong> stage = <code className="font-mono">new</code> AND outreachSentAt IS NULL AND createdAt &lt; now − delayMinutes AND bucket bukan <code className="font-mono">unclassified</code>.</p>
          <p><strong>Pacing:</strong> sequential ~250ms per email (Resend rate limit safe). Max 50 sends per cron run untuk respect Vercel function timeout.</p>
          <p><strong>Idempotency:</strong> setelah send, Lead.outreachSentAt diisi → lead itu di-skip di cron run berikutnya.</p>
          <p><strong>Disabled = hard stop:</strong> cron exit early tanpa query DB lain. Aman untuk pause kapanpun.</p>
        </div>
      </details>
    </div>
  );
}
