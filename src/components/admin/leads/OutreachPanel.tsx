"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { templateBucketFor, type Lead, type OutreachLog } from "@/lib/leads/types";

interface Props {
  lead: Lead;
  outreach: OutreachLog[];
  /** Called after a successful send so the parent can refresh. */
  onChanged: () => void;
  /** "compact" hides the recent-sent list (for inline row expansion). */
  variant?: "full" | "compact";
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min}m yang lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j yang lalu`;
  const d = Math.floor(hr / 24);
  return `${d}h yang lalu`;
}

/**
 * Renders the outreach email panel: preview hint + send button + last
 * sent log. Send action POSTs to `/api/new-leads/[id]/outreach`. On
 * success, calls `onChanged()` to let the parent refetch.
 *
 * For buckets without a template (`unclassified`), the send button is
 * disabled with a hint to override bucket first.
 */
export default function OutreachPanel({ lead, outreach, onChanged, variant = "full" }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const templateKey = templateBucketFor(lead.bucket);
  const lastSent = outreach[0]; // detail endpoint returns newest-first

  async function send() {
    if (!templateKey) return;
    setBusy(true);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch(`/api/new-leads/${lead.id}/outreach`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      setOkMsg("Email terkirim ✓");
      onChanged();
      setTimeout(() => setOkMsg(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!templateKey) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-text-muted">
          Bucket <strong>{lead.bucket}</strong> tidak punya template otomatis. Override ke bucket A/B/C/D/incomplete/domestic dulu untuk kirim outreach.
        </p>
      </div>
    );
  }

  // Compact variant — for inline row expansion: just a single button + last-sent line.
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="mail" size={12} />
          {busy ? "Mengirim…" : lastSent ? "Kirim ulang" : "Kirim outreach"}
        </button>
        {lastSent && (
          <span className="text-[11px] text-text-muted-2">
            Last sent: {relativeTime(lastSent.sentAt)} · template <span className="font-mono">{lastSent.templateUsed}</span>
            {lastSent.openedAt && <span className="text-emerald-600"> · opened</span>}
            {lastSent.clickedAt && <span className="text-blue-600"> · clicked</span>}
            {lastSent.bouncedAt && <span className="text-danger"> · bounced</span>}
          </span>
        )}
        {err && <span className="text-[11px] text-danger">⚠ {err}</span>}
        {okMsg && <span className="text-[11px] text-emerald-600">{okMsg}</span>}
      </div>
    );
  }

  // Full variant — for detail page.
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-xs text-text-muted">
          Template: <span className="font-mono font-medium">{templateKey}</span>
          {" · "}
          Akan dikirim dari <span className="font-mono">ilham.razak@satutuju.id</span> ke <span className="font-mono">{lead.email}</span>
        </p>
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="mail" size={12} />
          {busy ? "Mengirim…" : lastSent ? "Kirim ulang" : "Kirim outreach"}
        </button>
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

      {/* Recent sends */}
      {outreach.length === 0 ? (
        <p className="text-xs text-text-muted-2 italic">Belum pernah dikirim.</p>
      ) : (
        <ul className="space-y-1.5">
          {outreach.slice(0, 3).map((o) => (
            <li key={o.id} className="text-xs flex items-start gap-2 flex-wrap">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted-2 mt-1.5 flex-shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate">{o.subject}</div>
                <div className="text-text-muted-2 text-[11px]">
                  {formatStamp(o.sentAt)} · template <span className="font-mono">{o.templateUsed}</span>
                  {o.status === "failed" && (
                    <span className="text-danger"> · failed: {o.errorMessage ?? "no detail"}</span>
                  )}
                  {o.status === "sent" && (
                    <>
                      {o.openedAt && <span className="text-emerald-600"> · opened {relativeTime(o.openedAt)}</span>}
                      {o.clickedAt && <span className="text-blue-600"> · clicked {relativeTime(o.clickedAt)}</span>}
                      {o.bouncedAt && <span className="text-danger"> · bounced</span>}
                      {!o.openedAt && !o.clickedAt && !o.bouncedAt && (
                        <span className="text-text-muted-2"> · awaiting engagement</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
