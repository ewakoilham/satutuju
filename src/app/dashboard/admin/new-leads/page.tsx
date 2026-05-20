"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import LeadBucketBadge from "@/components/admin/leads/LeadBucketBadge";
import LeadStageBadge from "@/components/admin/leads/LeadStageBadge";
import LeadRowExpanded from "@/components/admin/leads/LeadRowExpanded";
import BulkActionBar from "@/components/admin/leads/BulkActionBar";
import {
  LEAD_BUCKETS,
  LEAD_STAGES,
  FUNDING_PLANS,
  type Lead,
  type LeadBucket,
  type LeadStage,
  type FundingPlan,
  fundingPlanLabelId,
} from "@/lib/leads/types";

interface ListResponse {
  leads: Lead[];
  total: number;
  progress: Record<string, { done: number; total: number }>;
  bucketCounts: Record<string, number>;
}

/** Selectable page-size options. API caps at 200 (see /api/new-leads
 *  route.ts), so don't add larger values without raising that ceiling. */
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
        active
          ? "bg-primary text-white"
          : "bg-surface border border-border text-text-muted hover:border-primary-200"
      }`}
    >
      {children}
    </button>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}b`;
}

export default function NewLeadsListPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bucketFilter, setBucketFilter] = useState<Set<LeadBucket>>(new Set());
  const [stageFilter, setStageFilter]   = useState<Set<LeadStage>>(new Set());
  const [fundingFilter, setFundingFilter] = useState<Set<FundingPlan>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Bulk selection state — tracks IDs across all pages (Set is cheap +
  // survives pagination). Cleared on filter change so admin doesn't
  // accidentally fire outreach to leads they can no longer see.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<
    { sent: number; failed: number; skipped: number } | null
  >(null);
  // When ON, the bulk send filters out leads with outreachSentAt !== null
  // so admin doesn't accidentally double-send. Defaults to true the moment
  // the confirm modal opens (set in onSendOutreach handler) — see below.
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page when filters change OR page size changes —
  // staying on offset=N with a different page size lands the admin on
  // a weird position in the list.
  useEffect(() => {
    setOffset(0);
  }, [bucketFilter, stageFilter, fundingFilter, debouncedSearch, pageSize]);

  // Clear bulk selection when filters change — selected leads may no
  // longer be visible, and acting on hidden rows is confusing UX.
  useEffect(() => {
    setSelected(new Set());
  }, [bucketFilter, stageFilter, fundingFilter, debouncedSearch]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    bucketFilter.forEach((b) => params.append("bucket", b));
    stageFilter.forEach((s) => params.append("stage", s));
    fundingFilter.forEach((f) => params.append("funding", f));
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));

    try {
      const res = await fetch(`/api/new-leads?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [bucketFilter, stageFilter, fundingFilter, debouncedSearch, offset, pageSize]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  async function syncFromTally() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/new-leads/sync", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncMsg({ kind: "err", text: json.error || `HTTP ${res.status}` });
      } else {
        const parts = [
          `${json.created} new`,
          `${json.updated} updated`,
          json.skipped > 0 ? `${json.skipped} skipped` : null,
          json.errors?.length > 0 ? `${json.errors.length} errors` : null,
        ].filter(Boolean).join(" · ");
        setSyncMsg({ kind: "ok", text: `Synced from Tally: ${parts}` });
        await fetchList();
      }
    } catch (e) {
      setSyncMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 6000);
    }
  }

  function toggleBucket(b: LeadBucket) {
    setBucketFilter((s) => {
      const next = new Set(s);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }
  function toggleStage(s: LeadStage) {
    setStageFilter((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }
  function toggleFunding(f: FundingPlan) {
    setFundingFilter((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  const total = data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + pageSize, total);
  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  function renderPagination(position: "top" | "bottom") {
    // Always render at least the page-size selector — even when total
    // fits on one page admin may want to switch to "200 per page" to
    // batch-select more leads at once.
    if (!data) return null;
    const borderClass = position === "top" ? "border-b" : "border-t";
    const showNav = data.total > pageSize;
    return (
      <div className={`flex items-center justify-between p-3 gap-3 flex-wrap ${borderClass} border-border/60 bg-surface-elevated/30`}>
        <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted-2">
          {showNav && (
            <span>
              Halaman {Math.floor(offset / pageSize) + 1} dari {Math.ceil(total / pageSize)}
              <span className="hidden sm:inline"> · {pageStart}–{pageEnd} dari {total}</span>
            </span>
          )}
          <label className="inline-flex items-center gap-1.5">
            <span>Per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="text-xs bg-surface border border-border rounded px-1.5 py-0.5 text-foreground hover:border-primary-200 focus:outline-none focus:border-primary"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {showNav && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
              className="btn-ghost text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Icon name="chevron-left" size={12} /> Prev
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setOffset(offset + pageSize)}
              className="btn-ghost text-xs px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              Next <Icon name="chevron-right" size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Total bucket counts across ALL matching leads (not just current page).
  const counts = data?.bucketCounts ?? {};

  // ── Bulk-send wiring ───────────────────────────────────────────────────
  const visibleLeads = data?.leads ?? [];
  const visibleIds = visibleLeads.map((l) => l.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  // Bucket distribution of selected leads — informs the confirm-modal
  // preview ("3 A · 2 D · 1 incomplete") so admin sees what will fire.
  const bucketBreakdown = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of visibleLeads) {
      if (selected.has(l.id)) out[l.bucket] = (out[l.bucket] ?? 0) + 1;
    }
    return out;
    // Recompute when selection or visible page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data?.leads]);
  const willSkipUnclassified =
    (bucketBreakdown["unclassified"] ?? 0);

  // Partition selection by prior-outreach status. `alreadySent` are leads
  // with outreachSentAt set — when the skip toggle is on they get excluded
  // from the bulk POST. `notSent` are leads with outreachSentAt === null.
  const { alreadySentIds, notSentIds } = useMemo(() => {
    const sent: string[] = [];
    const fresh: string[] = [];
    for (const l of visibleLeads) {
      if (!selected.has(l.id)) continue;
      if (l.outreachSentAt) sent.push(l.id);
      else fresh.push(l.id);
    }
    return { alreadySentIds: sent, notSentIds: fresh };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data?.leads]);

  // The actual ID list that will be POSTed when admin confirms.
  const effectiveIds = skipAlreadySent ? notSentIds : Array.from(selected);

  async function runBulkOutreach() {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/new-leads/bulk-outreach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: effectiveIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBulkResult({ sent: 0, failed: 0, skipped: 0 });
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setBulkResult({ sent: json.sent, failed: json.failed, skipped: json.skipped });
        setSelected(new Set());
        await fetchList();
        // Auto-dismiss banner after a few seconds.
        setTimeout(() => setBulkResult(null), 8000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
      setBulkConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            New Leads
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Tally submissions → bucketed → tracked through the pipeline checklist.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={syncFromTally}
            disabled={syncing}
            className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Icon name="link" size={14} />
            {syncing ? "Syncing..." : "Sync from Tally"}
          </button>
          <Link
            href="/dashboard/admin/new-leads/pipeline"
            className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          >
            <Icon name="check" size={14} />
            Manage steps
          </Link>
        </div>
      </div>

      {syncMsg && (
        <div
          className={`text-sm px-4 py-2.5 rounded-xl border ${
            syncMsg.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-danger-light border-danger/30 text-danger"
          }`}
        >
          {syncMsg.text}
        </div>
      )}

      {/* Summary strip — shows current page counts; filters apply */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-muted">Showing {pageStart}–{pageEnd} of {total}</span>
          <span className="text-text-muted-2">·</span>
          {LEAD_BUCKETS.map((b) => (
            <span key={b} className="inline-flex items-center gap-1">
              <LeadBucketBadge bucket={b} />
              <span className="text-text-muted">{counts[b] ?? 0}</span>
            </span>
          ))}
        </div>
      )}

      {/* Bucket legend — collapsed by default. Click summary to expand. */}
      <details className="card p-0 group/legend">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground select-none">
          <span className="inline-flex items-center gap-2">
            <Icon name="lightbulb" size={14} className="text-primary" />
            Apa arti setiap bucket?
          </span>
          <Icon name="chevron-right" size={14} className="text-text-muted-2 transition-transform group-open/legend:rotate-90" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60">
          <ul className="grid gap-3 sm:grid-cols-2 text-sm">
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="A" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Mentor + partner kampus</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Negara mentee punya mentor kami + kampus tujuan ada di jaringan partner. Prioritas outreach tertinggi → outreach langsung → matching.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="B" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Hanya mentor (kampus belum partner)</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Mentor available di negara tujuan, tapi kampus spesifik mentee belum ada di jaringan partner. Bisa diproses dengan adjust ekspektasi atau saran kampus alternatif.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="C" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Hanya partner kampus (belum ada mentor)</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Kampus tujuan partner kami, tapi belum ada mentor dari negara tersebut. Bisa pakai mentor lintas-region atau tunda matching.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="D" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Tidak ada keduanya</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Belum ada mentor di negara tujuan + kampus tidak dalam jaringan partner. Outreach pakai template &ldquo;confirmation&rdquo; — kasih opsi alternatif region/kampus yang dicover.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="incomplete" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Form belum lengkap</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Kolom kampus &amp; negara tujuan tidak diisi di Tally. Outreach pakai template re-engagement — minta mentee melengkapi info supaya bisa diklasifikasi.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadBucketBadge bucket="domestic" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Target studi domestik (Indonesia)</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Mentee mengisi kampus di dalam negeri. Satu Tuju fokus study abroad — outreach pakai template polite decline + ajak daftar ulang kalau ada plan ke luar.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5 sm:col-span-2">
              <LeadBucketBadge bucket="unclassified" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">Belum ter-klasifikasi</div>
                <p className="text-xs text-text-muted leading-snug mt-0.5">
                  Negara tujuan tidak ter-parse dari form (terlalu vague, salah ketik, atau bukan negara yang sistem kenali). Perlu admin review manual + override bucket lewat detail page.
                </p>
              </div>
            </li>
          </ul>
          <p className="text-[11px] text-text-muted-2 italic mt-3">
            Logic: kombinasi <strong>has-country-mentor</strong> × <strong>is-campus-partner</strong>. Mentor list = seed di <code className="font-mono">src/lib/mentors.ts</code>; partner kampus = curated alias di <code className="font-mono">src/lib/leads/bucketing.ts</code>.
          </p>
        </div>
      </details>

      {/* Stage legend — explains the 12 funnel states + their triggers.
          Bucket = classification (static-ish), Stage = progress (dynamic). */}
      <details className="card p-0 group/stagelegend">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium text-foreground select-none">
          <span className="inline-flex items-center gap-2">
            <Icon name="lightbulb" size={14} className="text-primary" />
            Apa arti setiap stage? (funnel progress)
          </span>
          <Icon name="chevron-right" size={14} className="text-text-muted-2 transition-transform group-open/stagelegend:rotate-90" />
        </summary>
        <div className="px-4 pb-4 pt-1 border-t border-border/60">
          <p className="text-xs text-text-muted mb-3">
            <strong>Stage</strong> = posisi lead di funnel. Berbeda dari <strong>bucket</strong> (klasifikasi statis): satu lead punya 1 bucket + 1 stage di waktu yang sama. Stage hanya advance forward (monotonic) lewat webhook event &amp; admin action.
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-2 text-sm">
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="new" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Lead baru dari Tally. Belum disentuh. <span className="text-text-muted-2">Trigger: <strong>sync dari Tally</strong> (auto).</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="outreach_sent" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Admin sudah kirim email pertama via Resend. <span className="text-text-muted-2">Trigger: <strong>klik &ldquo;Kirim outreach&rdquo;</strong> (single/bulk). Auto-advance dari <code className="font-mono">new</code>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="email_opened" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Recipient buka email (pixel tracking). <span className="text-text-muted-2">Trigger: <strong>Resend webhook</strong> event <code className="font-mono">email.opened</code>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="email_clicked" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Recipient klik link di body email. <span className="text-text-muted-2">Trigger: <strong>Resend webhook</strong> event <code className="font-mono">email.clicked</code>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="call_scheduled" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Initial call sudah dijadwalkan. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong> via Call Panel (Phase 5).</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="call_completed" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Call selesai, readiness score sudah dinilai. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="deposit_pending" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Invoice/deposit sudah dikirim, menunggu pembayaran. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="deposit_paid" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Deposit terbayar — lead siap di-pair. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong> (Phase 5: payment webhook).</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="matched" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Sudah di-match dengan mentor. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong> via Mentor Matching Panel (Phase 5).</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="declined" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Mentee mundur sendiri. <span className="text-text-muted-2">Trigger: <strong>admin manual</strong>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="waitlist" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Ditahan sementara (timing/kapasitas). <span className="text-text-muted-2">Trigger: <strong>admin manual</strong>.</span>
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <LeadStageBadge stage="rejected" />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-snug">
                  Kita reject (mis. red flags). <span className="text-text-muted-2">Trigger: <strong>admin manual</strong>.</span>
                </p>
              </div>
            </li>
          </ul>
          <p className="text-[11px] text-text-muted-2 italic mt-3">
            <strong>Monotonic advance:</strong> webhook event tidak akan menurunkan stage. Mis: lead di stage <code className="font-mono">call_scheduled</code> lalu Resend kirim event <code className="font-mono">email.opened</code> (mungkin recipient buka email lama) — stage tidak akan downgrade. Engagement timestamp tetap dicatat di OutreachLog.
            <br />
            <strong>Free-choice override:</strong> dropdown &ldquo;Pindah ke stage&rdquo; di inline row mengizinkan admin geser ke stage manapun (forward atau backward) untuk koreksi manual.
          </p>
        </div>
      </details>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text-muted-2 mr-1">Bucket</span>
          {LEAD_BUCKETS.map((b) => (
            <FilterChip key={b} active={bucketFilter.has(b)} onClick={() => toggleBucket(b)}>
              {b === "unclassified" ? "?" : b}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text-muted-2 mr-1">Stage</span>
          {LEAD_STAGES.map((s) => (
            <FilterChip key={s} active={stageFilter.has(s)} onClick={() => toggleStage(s)}>
              {s}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text-muted-2 mr-1">Funding</span>
          {FUNDING_PLANS.map((f) => (
            <FilterChip key={f} active={fundingFilter.has(f)} onClick={() => toggleFunding(f)}>
              {fundingPlanLabelId(f)}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="Cari nama, email, atau target kampus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1 max-w-md"
          />
          {(bucketFilter.size > 0 || stageFilter.size > 0 || fundingFilter.size > 0 || search) && (
            <button
              type="button"
              onClick={() => {
                setBucketFilter(new Set());
                setStageFilter(new Set());
                setFundingFilter(new Set());
                setSearch("");
              }}
              className="btn-ghost text-xs"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {renderPagination("top")}
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={6} />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-danger">Error: {error}</div>
        ) : !data || data.leads.length === 0 ? (
          <div className="p-12 text-center text-sm text-text-muted">
            {total === 0 && bucketFilter.size === 0 && stageFilter.size === 0 && fundingFilter.size === 0 && !search
              ? "Belum ada lead. Klik \"Sync from Tally\" di atas untuk mengimpor submission dari form."
              : "Tidak ada lead yang cocok dengan filter."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated/60">
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted-2">
                <th className="pl-4 pr-2 py-2.5 font-medium w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={toggleAllVisible}
                    className="accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium hidden md:table-cell">Target</th>
                <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Funding</th>
                <th className="px-3 py-2.5 font-medium">Bucket</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium hidden md:table-cell">Progress</th>
                <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Engagement</th>
                <th className="px-3 py-2.5 font-medium hidden xl:table-cell">Updated</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((lead) => {
                const prog = data.progress[lead.id] ?? { done: 0, total: 0 };
                const opened = lead.emailOpenedAt !== null;
                const clicked = lead.emailClickedAt !== null;
                const isExpanded = expandedId === lead.id;
                return (
                  <Fragment key={lead.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    className={`border-t-2 transition-colors cursor-pointer ${
                      isExpanded
                        ? "bg-primary-50/70 border-t-primary border-b-0"
                        : "border-t-border/60 hover:bg-surface-elevated/40"
                    }`}
                  >
                    <td className="pl-4 pr-2 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        checked={selected.has(lead.id)}
                        onChange={() => toggleOne(lead.id)}
                        className="accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground truncate max-w-[220px]">{lead.name}</div>
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-xs text-text-muted hover:text-primary truncate block max-w-[220px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="text-xs text-foreground truncate max-w-[260px]">{lead.targetCampusAndProgram}</div>
                      {lead.parsedCountry && (
                        <div className="text-[10px] text-text-muted-2 mt-0.5">{lead.parsedCountry}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell text-xs text-text-muted">
                      {fundingPlanLabelId(lead.fundingPlan)}
                    </td>
                    <td className="px-3 py-3">
                      <LeadBucketBadge bucket={lead.bucket} />
                    </td>
                    <td className="px-3 py-3">
                      <LeadStageBadge stage={lead.stage} />
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <div className="text-xs text-text-muted">
                        {prog.done}/{prog.total}
                      </div>
                      <div className="w-16 h-1 bg-surface-elevated rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: prog.total > 0 ? `${(prog.done / prog.total) * 100}%` : "0%" }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-text-muted-2">
                        {opened ? (
                          <span title={`Opened ${lead.emailOpenedAt}`} className="text-emerald-600">
                            <Icon name="check" size={12} />
                          </span>
                        ) : null}
                        {clicked ? (
                          <span title={`Clicked ${lead.emailClickedAt}`} className="text-blue-600">
                            <Icon name="link" size={12} />
                          </span>
                        ) : null}
                        {!opened && !clicked && lead.outreachSentAt && (
                          <span className="text-[10px] text-text-muted-2">sent, no open</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell text-xs text-text-muted-2">
                      {relativeTime(lead.updatedAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Icon
                        name={isExpanded ? "chevron-down" : "chevron-right"}
                        size={14}
                        className="text-text-muted-2 inline-block"
                      />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-t-0 border-b-2 border-b-primary">
                      <td colSpan={10} className="p-0">
                        <LeadRowExpanded lead={lead} onChanged={fetchList} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        {renderPagination("bottom")}
      </div>

      {/* Inline result banner after a bulk run. Auto-dismisses after
          a few seconds, but admin can also dismiss explicitly. */}
      {bulkResult && (
        <div className="card p-3 text-sm flex items-center justify-between gap-3 flex-wrap border-emerald-200 bg-emerald-50/40">
          <span className="text-emerald-900">
            ✓ Bulk outreach selesai —
            <strong> {bulkResult.sent} sent</strong>
            {bulkResult.failed > 0 && (
              <span className="text-danger"> · <strong>{bulkResult.failed} failed</strong></span>
            )}
            {bulkResult.skipped > 0 && (
              <span className="text-text-muted"> · <strong>{bulkResult.skipped} skipped</strong></span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setBulkResult(null)}
            className="btn-ghost text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sticky bottom bar (only visible when selection > 0) */}
      <BulkActionBar
        selectedCount={selected.size}
        bucketBreakdown={bucketBreakdown}
        busy={bulkBusy}
        onSendOutreach={() => {
          // Default the skip-flag to ON whenever any selected lead has
          // been outreached before — protects against accidental double-
          // sends. Admin can untick to force re-send.
          setSkipAlreadySent(alreadySentIds.length > 0);
          setBulkConfirmOpen(true);
        }}
        onClear={() => setSelected(new Set())}
      />

      {/* Custom confirm modal with skip-already-sent toggle. The body
          surfaces the actual effective count so admin knows exactly
          what's about to fire. */}
      <Modal
        open={bulkConfirmOpen}
        onClose={() => bulkBusy ? null : setBulkConfirmOpen(false)}
        title={`Kirim outreach ke ${effectiveIds.length} leads?`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(false)}
              disabled={bulkBusy}
              className="btn-ghost"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void runBulkOutreach()}
              disabled={bulkBusy || effectiveIds.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {bulkBusy ? "Mengirim…" : `Kirim ${effectiveIds.length}`}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {/* Selection summary */}
          <div className="text-xs text-text-muted space-y-1">
            <div>
              <strong>{selected.size}</strong> lead terpilih:{" "}
              <span className="text-text-muted-2">
                {Object.entries(bucketBreakdown)
                  .map(([b, n]) => `${n} ${b}`)
                  .join(" · ")}
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle" />
                <strong>{notSentIds.length}</strong> belum pernah dikirim
              </span>
              {alreadySentIds.length > 0 && (
                <span>
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5 align-middle" />
                  <strong>{alreadySentIds.length}</strong> sudah pernah dikirim
                </span>
              )}
            </div>
          </div>

          {/* Toggle — only show when admin actually has a choice */}
          {alreadySentIds.length > 0 && (
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-elevated/40 border border-border/60 cursor-pointer">
              <input
                type="checkbox"
                checked={skipAlreadySent}
                onChange={(e) => setSkipAlreadySent(e.target.checked)}
                className="accent-primary mt-0.5"
              />
              <div className="text-xs">
                <div className="font-medium text-foreground">
                  Skip {alreadySentIds.length} lead yang sudah pernah dikirim
                </div>
                <div className="text-text-muted-2 leading-snug mt-0.5">
                  Aman dari kirim email duplikat. Untick kalau memang mau resend (mis. follow-up setelah seminggu tanpa respons).
                </div>
              </div>
            </label>
          )}

          {willSkipUnclassified > 0 && (
            <div className="text-xs text-text-muted-2 px-3 py-2 rounded bg-zinc-50 border border-zinc-200">
              ⓘ {willSkipUnclassified} lead di bucket <code className="font-mono">unclassified</code> akan di-skip backend (tidak ada template).
            </div>
          )}

          <p className="text-[11px] text-text-muted-2 italic">
            Email dikirim sequential ~250ms per lead via Resend. Template dipilih otomatis sesuai bucket masing-masing.
          </p>
        </div>
      </Modal>
    </div>
  );
}
