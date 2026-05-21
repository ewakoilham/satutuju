"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { templateBucketFor, type Lead, type OutreachChannel, type OutreachLog } from "@/lib/leads/types";
import { formatJakartaStamp, formatJakartaRelative } from "@/lib/datetime-id";

interface Props {
  lead: Lead;
  outreach: OutreachLog[];
  /** Called after a successful send so the parent can refresh. */
  onChanged: () => void;
  /** "compact" hides the recent-sent list (for inline row expansion). */
  variant?: "full" | "compact";
}

const formatStamp = formatJakartaStamp;
const relativeTime = formatJakartaRelative;

type ChannelChoice = "email" | "whatsapp" | "both";

const CHANNEL_OPTIONS: Array<{ value: ChannelChoice; label: string; icon: "mail" | "chat" }> = [
  { value: "email",    label: "Email",        icon: "mail" },
  { value: "whatsapp", label: "WhatsApp",     icon: "chat" },
  { value: "both",     label: "Email + WA",   icon: "mail" },
];

function channelsFor(choice: ChannelChoice): OutreachChannel[] {
  if (choice === "email") return ["email"];
  if (choice === "whatsapp") return ["whatsapp"];
  return ["email", "whatsapp"];
}

interface OutcomeFromApi {
  channel: OutreachChannel;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  error?: string;
}

/**
 * Renders the outreach panel: channel picker (Email / WA / Both) + send
 * button + last sent log. POSTs to `/api/new-leads/[id]/outreach` with
 * `{ channels: OutreachChannel[] }`.
 *
 * Per-channel outcomes are independent — admin sees a summary like
 * "Email ✓, WA skipped (no number)" rather than a single pass/fail.
 */
export default function OutreachPanel({ lead, outreach, onChanged, variant = "full" }: Props) {
  const [channelChoice, setChannelChoice] = useState<ChannelChoice>("both");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const templateKey = templateBucketFor(lead.bucket);
  const lastSent = outreach[0]; // detail endpoint returns newest-first
  const hasWaNumber = !!lead.whatsappNumber;

  async function send() {
    if (!templateKey) return;
    setBusy(true);
    setErr(null);
    setResultMsg(null);
    try {
      const channels = channelsFor(channelChoice);
      const res = await fetch(`/api/new-leads/${lead.id}/outreach`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const body = await res.json().catch(() => ({}));
      // Surface per-channel outcomes whether the overall call succeeded
      // (200) or all channels skipped (400). Both contain the same
      // `outcomes` array — the only difference is whether at least one
      // channel actually fired.
      const outcomes: OutcomeFromApi[] = body.outcomes ?? [];
      const parts: string[] = [];
      for (const o of outcomes) {
        const ch = o.channel === "email" ? "Email" : "WA";
        if (o.status === "sent") parts.push(`${ch} ✓`);
        else if (o.status === "failed") parts.push(`${ch} gagal: ${o.error ?? "unknown"}`);
        else parts.push(`${ch} skip — ${o.reason ?? "?"}`);
      }
      if (!res.ok) {
        // All channels skipped — show the detailed reasons so admin
        // knows whether to add a WA template body, override the bucket,
        // or fix the lead's WA number.
        setErr(parts.length > 0 ? parts.join(" · ") : (body.error || `HTTP ${res.status}`));
        return;
      }
      setResultMsg(parts.join(" · "));
      onChanged();
      setTimeout(() => setResultMsg(null), 8000);
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

  // Channel picker — used by both variants.
  const channelPicker = (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
      {CHANNEL_OPTIONS.map((opt) => {
        const isActive = channelChoice === opt.value;
        const disabled = (opt.value === "whatsapp" || opt.value === "both") && !hasWaNumber;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setChannelChoice(opt.value)}
            disabled={disabled}
            title={disabled ? "Lead tidak punya WA number — pakai Email saja" : undefined}
            className={`px-2.5 py-1 inline-flex items-center gap-1 transition ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-surface hover:bg-surface-elevated"
            } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Icon name={opt.icon} size={11} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  // Compact variant — for inline row expansion.
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {channelPicker}
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="check" size={12} />
          {busy ? "Mengirim…" : lastSent ? "Kirim ulang" : "Reachout"}
        </button>
        {lastSent && (
          <span className="text-[11px] text-text-muted-2">
            Last: {relativeTime(lastSent.sentAt)} · {lastSent.channel === "whatsapp" ? "WA" : "Email"}
            {lastSent.openedAt && <span className="text-emerald-600"> · opened</span>}
            {lastSent.clickedAt && <span className="text-blue-600"> · clicked</span>}
            {lastSent.bouncedAt && <span className="text-danger"> · bounced</span>}
          </span>
        )}
        {err && <span className="text-[11px] text-danger">⚠ {err}</span>}
        {resultMsg && <span className="text-[11px] text-emerald-700">{resultMsg}</span>}
      </div>
    );
  }

  // Full variant — for detail page.
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="text-xs text-text-muted space-y-0.5">
          <p>
            Template: <span className="font-mono font-medium">{templateKey}</span>
          </p>
          <p>
            Email → <span className="font-mono">{lead.email}</span>
          </p>
          <p>
            WhatsApp → {hasWaNumber ? (
              <span className="font-mono">{lead.whatsappNumber}</span>
            ) : (
              <span className="text-text-muted-2 italic">tidak tersedia — channel WA akan di-skip</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {channelPicker}
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="btn-primary text-xs px-3 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="check" size={12} />
            {busy ? "Mengirim…" : lastSent ? "Reachout ulang" : "Reachout"}
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs px-3 py-2 rounded bg-danger-light border border-danger/30 text-danger">
          ⚠ {err}
        </div>
      )}
      {resultMsg && (
        <div className="text-xs px-3 py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
          {resultMsg}
        </div>
      )}

      {/* Recent sends */}
      {outreach.length === 0 ? (
        <p className="text-xs text-text-muted-2 italic">Belum pernah dikirim.</p>
      ) : (
        <ul className="space-y-1.5">
          {outreach.slice(0, 5).map((o) => (
            <li key={o.id} className="text-xs flex items-start gap-2 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                o.channel === "whatsapp" ? "bg-emerald-500" : "bg-blue-500"
              }`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-foreground truncate">
                  <span className="text-[10px] uppercase font-semibold mr-1.5">
                    [{o.channel === "whatsapp" ? "WA" : "EMAIL"}]
                  </span>
                  {o.subject}
                </div>
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
