"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import LeadBucketBadge from "./LeadBucketBadge";
import LeadStageBadge from "./LeadStageBadge";
import OutreachPanel from "./OutreachPanel";
import {
  LEAD_BUCKETS,
  LEAD_STAGES,
  type Lead,
  type LeadBucket,
  type LeadStage,
  type LeadStageHistory,
  type OutreachLog,
} from "@/lib/leads/types";

interface DetailFetch {
  history: LeadStageHistory[];
  outreach: OutreachLog[];
}

interface Props {
  lead: Lead;
  onChanged: () => void;
}

/** Normalize a free-form WhatsApp number into wa.me-compatible E.164 form
 *  (Indonesian numbers default to +62). Drops non-digits, converts a
 *  leading 0 to 62. */
function waMeUrl(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
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

/**
 * Inline expanded panel under a lead row. Surfaces classification details,
 * quick actions (move stage, override bucket, reclassify, assign), and
 * recent history. Lets the admin act without navigating to the full detail
 * page for common ops.
 */
export default function LeadRowExpanded({ lead, onChanged }: Props) {
  const [history, setHistory] = useState<LeadStageHistory[] | null>(null);
  const [outreach, setOutreach] = useState<OutreachLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bucketOverride, setBucketOverride] = useState<LeadBucket | "">("");
  const [overrideReason, setOverrideReason] = useState("");
  // Bumped after any successful inline mutation (stage/bucket/outreach
  // send) to trigger a fresh detail re-fetch — keeps the panel in sync
  // without forcing a full table reload from the parent.
  const [refetchTick, setRefetchTick] = useState(0);

  // Lazy-fetch detail to surface recent history + outreach log.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/new-leads/${lead.id}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as DetailFetch;
        setHistory(json.history.slice(0, 3));
        setOutreach(json.outreach ?? []);
      } catch {
        /* network error — leave history null */
      }
    })();
    return () => { cancelled = true; };
  }, [lead.id, refetchTick]);

  async function call(label: string, fn: () => Promise<Response>) {
    setBusy(label);
    setErr(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return false;
      }
      onChanged();
      setRefetchTick((t) => t + 1);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function changeStage(stage: LeadStage) {
    if (stage === lead.stage) return;
    await call("stage", () =>
      fetch(`/api/new-leads/${lead.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stage }),
      }),
    );
  }

  async function submitBucketOverride() {
    if (!bucketOverride || !overrideReason.trim()) {
      setErr("Pilih bucket baru + isi justifikasi");
      return;
    }
    const ok = await call("bucket", () =>
      fetch(`/api/new-leads/${lead.id}/bucket`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bucket: bucketOverride, reason: overrideReason.trim() }),
      }),
    );
    if (ok) {
      setBucketOverride("");
      setOverrideReason("");
    }
  }

  async function reclassify() {
    await call("reclassify", () =>
      fetch(`/api/new-leads/${lead.id}/reclassify`, {
        method: "POST",
        credentials: "include",
      }),
    );
  }

  const waUrl = waMeUrl(lead.whatsappNumber);

  return (
    <div className="bg-primary-50/60 border-l-4 border-l-primary px-5 py-4 space-y-4">
      {/* Contact strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
          <Icon name="document" size={12} className="text-text-muted-2" />
          {lead.email}
        </a>
        {lead.whatsappNumber && (
          waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
              title="Buka di WhatsApp Web"
            >
              <Icon name="link" size={12} className="text-text-muted-2" />
              <span className="font-mono">{lead.whatsappNumber}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <Icon name="link" size={12} className="text-text-muted-2" />
              <span className="font-mono">{lead.whatsappNumber}</span>
            </span>
          )
        )}
      </div>

      {/* Classification facts — color-coded so admin can quick-assess
          at a glance:
          - Country: green when mentor available, red when no mentor
          - Campus:  green when partner in our network, red when not
          Bucket/stage are on the parent row so no need to repeat. */}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5 text-sm">
        <div className="inline-flex items-center gap-1.5">
          <span className="text-xs text-text-muted-2">Country:</span>
          {lead.parsedCountry ? (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                lead.hasCountryMentor
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
              title={lead.hasCountryMentor ? "Mentor available" : "No mentor in this country"}
            >
              {lead.hasCountryMentor ? "✓" : "✗"} {lead.parsedCountry}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700" title="Country not parsed">
              ? unclear
            </span>
          )}
        </div>
        <span className="text-text-muted-2 mx-1">·</span>
        <div className="inline-flex items-center gap-1.5">
          <span className="text-xs text-text-muted-2">Campus:</span>
          {lead.parsedCampus ? (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                lead.isCampusPartner === true
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-800"
              }`}
              title={lead.isCampusPartner === true ? "Partner kampus" : "Not in partner list"}
            >
              {lead.isCampusPartner === true ? "✓" : "✗"} {lead.parsedCampus}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700" title="Campus not identified in alias list">
              ? not in alias list
            </span>
          )}
        </div>
        <span className="text-text-muted-2 mx-1">·</span>
        <div className="inline-flex items-center gap-1.5">
          <span className="text-xs text-text-muted-2">Funding:</span>
          <span className="text-foreground">{lead.fundingPlan}</span>
        </div>
      </div>

      {lead.bucketReason && (
        <p className="text-xs text-text-muted italic">{lead.bucketReason}</p>
      )}

      {/* Outreach (compact) — primary CTA inline so admin can dispatch
          email without opening the full detail page. */}
      <div className="pt-1">
        <OutreachPanel
          lead={lead}
          outreach={outreach}
          onChanged={() => {
            onChanged();
            setRefetchTick((t) => t + 1);
          }}
          variant="compact"
        />
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        {/* Stage transition */}
        <div className="space-y-1 max-w-md">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">Pindah ke stage</label>
          <select
            value={lead.stage}
            onChange={(e) => void changeStage(e.target.value as LeadStage)}
            disabled={busy === "stage"}
            className="input-field text-sm"
          >
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Bucket override */}
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-text-muted-2">
            Override bucket (manual)
          </label>
          <div className="flex flex-wrap items-stretch gap-2">
            <select
              value={bucketOverride}
              onChange={(e) => setBucketOverride(e.target.value as LeadBucket | "")}
              disabled={busy === "bucket"}
              className="input-field text-sm w-auto min-w-[120px]"
            >
              <option value="">Pilih bucket baru…</option>
              {LEAD_BUCKETS.map((b) => (
                <option key={b} value={b} disabled={b === lead.bucket}>
                  {b}{b === lead.bucket ? " (current)" : ""}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Justifikasi (wajib)…"
              disabled={busy === "bucket" || !bucketOverride}
              className="input-field text-sm flex-1 min-w-[200px]"
            />
            <button
              type="button"
              onClick={() => void submitBucketOverride()}
              disabled={busy === "bucket" || !bucketOverride || !overrideReason.trim()}
              className="btn-primary text-xs px-3 disabled:opacity-50"
            >
              {busy === "bucket" ? "Saving…" : "Override"}
            </button>
          </div>
        </div>
      </div>

      {/* Re-classify + full detail link */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => void reclassify()}
          disabled={busy === "reclassify"}
          className="btn-ghost text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Icon name="link" size={12} />
          {busy === "reclassify" ? "Re-classifying…" : "Re-classify"}
        </button>
        <Link
          href={`/dashboard/admin/new-leads/${lead.id}`}
          className="btn-ghost text-xs inline-flex items-center gap-1.5"
        >
          Lihat full detail <Icon name="chevron-right" size={12} />
        </Link>
        {err && (
          <span className="text-xs text-danger">⚠ {err}</span>
        )}
      </div>

      {/* Recent history */}
      <div className="pt-2 border-t border-border/60">
        <div className="text-[11px] uppercase tracking-wider text-text-muted-2 mb-2">
          Activity terbaru
        </div>
        {history === null ? (
          <div className="text-xs text-text-muted-2">Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-text-muted-2">No transitions yet</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted-2 mt-1.5 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-foreground">
                    {h.fromStage ? `${h.fromStage} → ${h.toStage}` : h.toStage}
                  </span>
                  <span className="text-text-muted-2 ml-1.5">
                    {formatStamp(h.createdAt)} · {h.changedBy}
                  </span>
                  {h.note && (
                    <div className="text-text-muted italic mt-0.5 line-clamp-2">{h.note}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
