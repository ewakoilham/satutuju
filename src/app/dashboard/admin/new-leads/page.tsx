"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import {
  LEAD_BUCKETS,
  type Lead,
  type LeadBucket,
  type LeadStage,
} from "@/lib/leads/types";
import KpiStrip from "@/components/admin/leads/inbox/KpiStrip";
import { formatJakartaDateTime } from "@/lib/datetime-id";
import SmartSegments, {
  SEGMENTS,
  type SegmentId,
} from "@/components/admin/leads/inbox/SmartSegments";
import LeadInboxRow from "@/components/admin/leads/inbox/LeadInboxRow";
import LeadDetailPanel from "@/components/admin/leads/inbox/LeadDetailPanel";
import PipelineSubnav from "@/components/admin/leads/PipelineSubnav";

/**
 * Smart Inbox — email-client style triage layout for the admin leads
 * pipeline. Three columns:
 *
 *   ┌────────────┬────────────────────────────┬──────────────┐
 *   │ Segments + │  Lead list (dense rows)    │  Detail      │
 *   │ Bucket     │  KPI strip + search        │  panel       │
 *   │ filter     │  Bulk action header        │  (slide-over)│
 *   └────────────┴────────────────────────────┴──────────────┘
 *
 * Smart segments collapse the legacy "13 stage filter chips" wall into
 * 7 curated views. Bucket filter chips become a per-bucket count list
 * in the sidebar. Detail panel shows AI brief + pipeline checklist +
 * activity timeline without leaving the page.
 */

interface ListResponse {
  leads: Lead[];
  total: number;
  progress: Record<string, { done: number; total: number }>;
  bucketCounts: Record<string, number>;
  mentorNoteCount: Record<string, number>;
}

interface StatsLite {
  bucketCounts: Record<string, number>;
  stageCounts: Record<string, number>;
  /** Bucket × stage crosstab from /stats. Lets us recompute segment
   *  counts when a bucket filter is active so the sidebar number
   *  matches the visible list. */
  bucketStageCounts: Record<string, Record<string, number>>;
  /** Phase 15: leads where classificationReviewedAt IS NULL. Drives
   *  the "Butuh review klasifikasi" segment counter + nav badge. */
  unreviewedCount: number;
}

/** Selectable page-size options. API caps at 200. */
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;

const SEGMENT_BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]));

/**
 * Compute per-segment counts from /stats. When `activeBuckets` is non-
 * empty, the counts compose with that bucket filter so the sidebar
 * matches the list pane (otherwise admin sees "Hot · 28" while the list
 * shows 1 because a bucket filter narrowed it). When no bucket filter
 * is active, falls through to the global stageCounts (cheaper, same
 * answer).
 */
function computeSegmentCounts(
  stats: StatsLite | null,
  total: number,
  activeBuckets: Set<LeadBucket>,
): Record<SegmentId, number> {
  const bucketCounts = stats?.bucketCounts ?? {};
  // When a bucket filter is active, use the crosstab restricted to those
  // buckets. Otherwise use the global stageCounts.
  let stageCounts: Record<string, number>;
  let scopedTotal: number;
  if (activeBuckets.size > 0 && stats?.bucketStageCounts) {
    stageCounts = {};
    scopedTotal = 0;
    for (const b of activeBuckets) {
      const byStage = stats.bucketStageCounts[b] ?? {};
      for (const [stage, n] of Object.entries(byStage)) {
        stageCounts[stage] = (stageCounts[stage] ?? 0) + n;
        scopedTotal += n;
      }
    }
  } else {
    stageCounts = stats?.stageCounts ?? {};
    scopedTotal = total;
  }
  const sum = (keys: string[], src: Record<string, number>) =>
    keys.reduce((a, k) => a + (src[k] ?? 0), 0);
  return {
    all:             scopedTotal,
    // Phase 15: needs_review count is sourced from stats.unreviewedCount
    // (not stageCounts) since it's a separate dimension. When a bucket
    // filter is active the count doesn't compose with it — admin sees
    // the global unreviewed total either way, which is the correct
    // attention-grabber.
    needs_review:    stats?.unreviewedCount ?? 0,
    new:             stageCounts.new ?? 0,
    wait:            stageCounts.outreach_sent ?? 0,
    engaged:         sum(["whatsapp_read", "email_opened", "email_clicked"], stageCounts),
    hot:             stageCounts.call_scheduled ?? 0,
    call_done:       stageCounts.call_completed ?? 0,
    waitlist:        stageCounts.waitlist ?? 0,
    deposit_pending: stageCounts.deposit_pending ?? 0,
    deposit_agreed:  stageCounts.deposit_agreed ?? 0,
    deposit_paid:    stageCounts.deposit_paid ?? 0,
    // Review = unclassified bucket. When a bucket filter is active and
    // doesn't include unclassified, this is 0.
    review:          activeBuckets.size === 0 || activeBuckets.has("unclassified")
                       ? (bucketCounts.unclassified ?? 0)
                       : 0,
    won:             stageCounts.matched ?? 0,
    // Phase 11: waitlist is no longer terminal — only declined+rejected.
    closed:          sum(["declined", "rejected"], stageCounts),
  };
}

export default function NewLeadsListPage() {
  // ── List data ─────────────────────────────────────────────────────
  const [data, setData] = useState<ListResponse | null>(null);
  const [stats, setStats] = useState<StatsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────
  const [activeSegment, setActiveSegment] = useState<SegmentId>("all");
  const [bucketFilter, setBucketFilter] = useState<Set<LeadBucket>>(new Set());
  const [stageFilter, setStageFilter] = useState<Set<LeadStage>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ── Pagination ────────────────────────────────────────────────────
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // ── Detail slide-over ─────────────────────────────────────────────
  const [openLead, setOpenLead] = useState<Lead | null>(null);

  // ── Sync state ────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [mutationTick, setMutationTick] = useState(0);
  const bumpMutationTick = () => setMutationTick((t) => t + 1);

  // Google Calendar OAuth status
  const [calendarAuth, setCalendarAuth] = useState<
    | { connected: false }
    | { connected: true; googleEmail: string | null; connectedAt: string; lastSyncAt: string | null }
    | null
  >(null);
  const [calendarSyncing, setCalendarSyncing] = useState(false);

  // ── Bulk selection ────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkChannel, setBulkChannel] = useState<"email" | "whatsapp" | "both">("both");
  const [bulkResult, setBulkResult] = useState<
    { channelsSent: number; channelsFailed: number; channelsSkipped: number; leadsSent: number } | null
  >(null);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);

  // Other bulk-action modals
  const [moveBucketOpen, setMoveBucketOpen] = useState(false);
  const [moveBucketTarget, setMoveBucketTarget] = useState<LeadBucket | "">("");
  const [moveBucketReason, setMoveBucketReason] = useState("");
  const [assignInterviewerOpen, setAssignInterviewerOpen] = useState(false);
  const [assignInterviewerName, setAssignInterviewerName] = useState("");

  // ── Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination when filters change.
  useEffect(() => {
    setOffset(0);
  }, [bucketFilter, stageFilter, debouncedSearch, pageSize, activeSegment]);

  // Clear bulk selection on filter change (otherwise admin can act on
  // rows they can no longer see — confusing).
  useEffect(() => {
    setSelected(new Set());
  }, [bucketFilter, stageFilter, debouncedSearch, activeSegment]);

  // Tracks the latest in-flight list request so older responses can't
  // overwrite newer state (e.g. rapid stage clicks → overlapping fetches).
  const fetchSeqRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchList = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    fetchAbortRef.current = ctrl;
    const seq = ++fetchSeqRef.current;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    bucketFilter.forEach((b) => params.append("bucket", b));
    stageFilter.forEach((s) => params.append("stage", s));
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    // Phase 15: needs_review segment adds the `reviewed=false` filter
    // server-side so the list pane stays narrow even with 100+ rows.
    if (SEGMENT_BY_ID.get(activeSegment)?.unreviewedOnly) {
      params.set("reviewed", "false");
    }

    try {
      const res = await fetch(`/api/new-leads?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (seq !== fetchSeqRef.current) return; // stale — discard
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const json = (await res.json()) as ListResponse;
      if (seq !== fetchSeqRef.current) return; // stale — discard
      setData(json);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // superseded
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [bucketFilter, stageFilter, debouncedSearch, offset, pageSize, activeSegment]);

  useEffect(() => {
    void fetchList();
    return () => fetchAbortRef.current?.abort();
  }, [fetchList]);

  // Lightweight stats fetch for KPI + sidebar counts. Refreshes only on
  // mutation (not on every pagination).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/new-leads/stats", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setStats({
          bucketCounts: j.bucketCounts ?? {},
          stageCounts: j.stageCounts ?? {},
          bucketStageCounts: j.bucketStageCounts ?? {},
          unreviewedCount: j.unreviewedCount ?? 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mutationTick]);

  // Google Calendar status probe + OAuth callback toast.
  const fetchCalendarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/new-leads/calendar-auth-status", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setCalendarAuth({ connected: false });
        return;
      }
      setCalendarAuth(await res.json());
    } catch {
      setCalendarAuth({ connected: false });
    }
  }, []);

  useEffect(() => {
    void fetchCalendarStatus();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("google");
      if (status === "connected") {
        const email = params.get("email") || "Google account";
        setSyncMsg({ kind: "ok", text: `Connected to ${email} ✓` });
        window.history.replaceState({}, "", window.location.pathname);
      } else if (status === "error") {
        const reason = params.get("reason") || "unknown";
        setSyncMsg({ kind: "err", text: `Google connect failed: ${reason}` });
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [fetchCalendarStatus]);

  // ── Sync actions ──────────────────────────────────────────────────
  async function syncFromTally() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/new-leads/sync", { method: "POST", credentials: "include" });
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
        bumpMutationTick();
      }
    } catch (e) {
      setSyncMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 6000);
    }
  }

  async function syncFromCalendar() {
    setCalendarSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/new-leads/calendar-sync", { method: "POST", credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setSyncMsg({ kind: "err", text: json.error || `HTTP ${res.status}` });
      } else {
        const parts = [
          `${json.eventsFetched} events fetched`,
          `${json.leadsAdvanced} leads → call_scheduled`,
          `${json.leadsReverted ?? 0} reverted (cancelled)`,
        ].join(" · ");
        setSyncMsg({ kind: "ok", text: `Synced from Calendar: ${parts}` });
        await fetchList();
        bumpMutationTick();
        await fetchCalendarStatus();
      }
    } catch (e) {
      setSyncMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setCalendarSyncing(false);
      setTimeout(() => setSyncMsg(null), 6000);
    }
  }

  // ── Segment + bucket filter wiring ────────────────────────────────
  //
  // Segments and bucket toggles are COMPOSABLE — admin can click a
  // segment (e.g. "Menunggu respons") AND then toggle bucket A to see
  // only bucket-A leads in that segment. Stage filter is fully owned by
  // the active segment; bucket filter is independent unless the segment
  // itself defines a bucket constraint (currently only "Butuh review").
  function selectSegment(id: SegmentId) {
    const seg = SEGMENT_BY_ID.get(id);
    if (!seg) return;
    setActiveSegment(id);
    // Always replace stage filter — segments are primarily stage-based.
    setStageFilter(new Set(seg.stages));
    // "Semua" = no filters at all (clears any leftover bucket filter so
    // admin gets a clean reset). Other segments either set their own
    // bucket constraint OR leave admin's bucket pick in place so the
    // two filters compose.
    if (id === "all") {
      setBucketFilter(new Set());
    } else if (seg.buckets.length > 0) {
      setBucketFilter(new Set(seg.buckets));
    }
    setOpenLead(null);
  }


  function toggleBucketFilter(b: LeadBucket) {
    // Bucket toggle composes with whatever segment is active — don't
    // reset stage filter or active segment.
    setBucketFilter((s) => {
      const next = new Set(s);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }

  // ── Bulk selection helpers ────────────────────────────────────────
  const visibleLeads = data?.leads ?? [];
  const visibleIds = visibleLeads.map((l) => l.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
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

  const bucketBreakdown = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of visibleLeads) {
      if (selected.has(l.id)) out[l.bucket] = (out[l.bucket] ?? 0) + 1;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data?.leads]);
  const willSkipUnclassified = bucketBreakdown["unclassified"] ?? 0;

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
  const effectiveIds = skipAlreadySent ? notSentIds : Array.from(selected);

  // Phase 15: how many selected leads are unreviewed. Drives both the
  // "Konfirmasi (n)" bulk button and a warning when the admin tries to
  // bulk-reachout a mix of reviewed + unreviewed leads.
  const unreviewedSelectedIds = useMemo(() => {
    const ids: string[] = [];
    for (const l of visibleLeads) {
      if (selected.has(l.id) && !l.classificationReviewedAt) ids.push(l.id);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, data?.leads]);

  // ── Bulk actions ──────────────────────────────────────────────────
  /** Phase 15: bulk-confirm classification review for selected leads.
   *  Fires the new /api/new-leads/review-bulk endpoint and refreshes
   *  stats so the segment counter + nav badge update. */
  async function runBulkReviewConfirm() {
    if (unreviewedSelectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/new-leads/review-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: unreviewedSelectedIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setSyncMsg({
          kind: "ok",
          text:
            json.reviewed > 0
              ? `Klasifikasi dikonfirmasi untuk ${json.reviewed} lead.` +
                (json.skippedAlready > 0 ? ` ${json.skippedAlready} sudah pernah direview.` : "")
              : "Semua lead di seleksi sudah direview sebelumnya.",
        });
        setSelected(new Set());
        await fetchList();
        bumpMutationTick();
        setTimeout(() => setSyncMsg(null), 6000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkReclassify() {
    if (selected.size === 0) return;
    if (!confirm(`Re-classify ${selected.size} leads dengan logika bucketing terbaru?`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/new-leads/bulk-classify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setSyncMsg({ kind: "ok", text: `Re-classified ${json.changed} dari ${json.total} leads (${json.unchanged} tidak berubah)` });
        setSelected(new Set());
        await fetchList();
        bumpMutationTick();
        setTimeout(() => setSyncMsg(null), 6000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkChangeBucket() {
    if (selected.size === 0 || !moveBucketTarget || !moveBucketReason.trim()) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/new-leads/bulk-change-bucket", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selected),
          bucket: moveBucketTarget,
          reason: moveBucketReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setSyncMsg({
          kind: "ok",
          text: `${json.changed} leads dipindahkan ke bucket ${moveBucketTarget}` +
            (json.skipped > 0 ? ` (${json.skipped} sudah di bucket itu, skip)` : ""),
        });
        setSelected(new Set());
        setMoveBucketTarget("");
        setMoveBucketReason("");
        setMoveBucketOpen(false);
        await fetchList();
        bumpMutationTick();
        setTimeout(() => setSyncMsg(null), 6000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkAssignInterviewer() {
    if (selected.size === 0) return;
    const value = assignInterviewerName.trim();
    setBulkBusy(true);
    try {
      const res = await fetch("/api/new-leads/bulk-assign-interviewer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected), interviewer: value || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setSyncMsg({
          kind: "ok",
          text: value
            ? `Assigned interviewer "${value}" ke ${json.updated} leads`
            : `Cleared interviewer dari ${json.updated} leads`,
        });
        setSelected(new Set());
        setAssignInterviewerName("");
        setAssignInterviewerOpen(false);
        await fetchList();
        bumpMutationTick();
        setTimeout(() => setSyncMsg(null), 6000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
    }
  }

  function runBulkExportCsv() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    window.location.href = `/api/new-leads/export?ids=${encodeURIComponent(ids)}`;
  }

  async function runBulkOutreach() {
    setBulkBusy(true);
    setBulkResult(null);
    try {
      const channels =
        bulkChannel === "both" ? ["email", "whatsapp"] :
        bulkChannel === "whatsapp" ? ["whatsapp"] : ["email"];
      const res = await fetch("/api/new-leads/bulk-outreach", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: effectiveIds, channels }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBulkResult({ channelsSent: 0, channelsFailed: 0, channelsSkipped: 0, leadsSent: 0 });
        alert(json.error || `HTTP ${res.status}`);
      } else {
        setBulkResult({
          channelsSent: json.channelsSent ?? 0,
          channelsFailed: json.channelsFailed ?? 0,
          channelsSkipped: json.channelsSkipped ?? 0,
          leadsSent: json.leadsSent ?? 0,
        });
        setSelected(new Set());
        await fetchList();
        bumpMutationTick();
        setTimeout(() => setBulkResult(null), 10000);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
      setBulkConfirmOpen(false);
    }
  }

  // ── Single-lead inline reachout (from row hover or detail panel) ──
  async function doSingleReachout(leadId: string, channel: "email" | "whatsapp" | "both") {
    setBulkBusy(true); // reuse bulkBusy as global pending flag
    try {
      const channels =
        channel === "both" ? ["email", "whatsapp"] :
        channel === "whatsapp" ? ["whatsapp"] : ["email"];
      const res = await fetch(`/api/new-leads/${leadId}/outreach`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels }),
      });
      const json = await res.json();
      type Outcome = { channel: string; status: "sent" | "failed" | "skipped"; error?: string; reason?: string };
      const outcomes: Outcome[] = (json.outcomes ?? []);
      const parts = outcomes.map((o) => {
        const ch = o.channel === "whatsapp" ? "WA" : "Email";
        if (o.status === "sent") return `${ch} ✓`;
        if (o.status === "failed") return `${ch} gagal: ${o.error ?? "?"}`;
        return `${ch} skip (${o.reason ?? "?"})`;
      });
      setSyncMsg({
        kind: res.ok ? "ok" : "err",
        text: parts.length > 0 ? parts.join(" · ") : (json.error || `HTTP ${res.status}`),
      });
      await fetchList();
      bumpMutationTick();
      setTimeout(() => setSyncMsg(null), 8000);
    } catch (e) {
      setSyncMsg({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setBulkBusy(false);
    }
  }

  function scheduleCallStub() {
    setSyncMsg({
      kind: "ok",
      text: "Untuk schedule call, buka detail lead → Call Panel (Phase 5b).",
    });
    setTimeout(() => setSyncMsg(null), 4000);
  }

  // ── Pagination helpers ────────────────────────────────────────────
  const total = data?.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + pageSize, total);
  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  // Counts used by sidebar/segments. Falls back to data.bucketCounts
  // when /stats hasn't returned yet.
  const segmentCounts = computeSegmentCounts(
    stats,
    stats ? Object.values(stats.bucketCounts).reduce((a, b) => a + b, 0) : total,
    bucketFilter,
  );
  const bucketCounts = stats?.bucketCounts ?? data?.bucketCounts ?? {};

  const activeSeg = SEGMENT_BY_ID.get(activeSegment);
  const segmentLabel = activeSeg?.label ?? "Semua";

  return (
    <div className="space-y-4">
      <PipelineSubnav />

      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Leads
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Tally → bucket → outreach → call → match.
            {calendarAuth?.connected && calendarAuth.lastSyncAt && (
              <> Last calendar sync {formatJakartaDateTime(calendarAuth.lastSyncAt)}.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={syncFromTally}
            disabled={syncing}
            className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            <Icon name="refresh" size={14} />
            {syncing ? "Syncing..." : "Sync Tally"}
          </button>
          {calendarAuth === null ? (
            <button type="button" disabled className="btn-ghost inline-flex items-center gap-1.5 text-sm opacity-50">
              <Icon name="calendar" size={14} /> Calendar…
            </button>
          ) : calendarAuth.connected ? (
            <button
              type="button"
              onClick={syncFromCalendar}
              disabled={calendarSyncing}
              className="btn-ghost inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
              title={`Connected as ${calendarAuth.googleEmail ?? "—"}`}
            >
              <Icon name="calendar" size={14} />
              {calendarSyncing ? "Syncing..." : "Sync Calendar"}
            </button>
          ) : (
            <a href="/api/auth/google" className="btn-ghost inline-flex items-center gap-1.5 text-sm">
              <Icon name="calendar" size={14} /> Connect Calendar
            </a>
          )}
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

      {bulkResult && (
        <div className="card p-3 text-sm flex items-center justify-between gap-3 flex-wrap border-emerald-200 bg-emerald-50/40">
          <span className="text-emerald-900">
            ✓ Bulk reachout selesai — <strong>{bulkResult.leadsSent} leads</strong> dikontak ·
            <strong> {bulkResult.channelsSent} channel sent</strong>
            {bulkResult.channelsFailed > 0 && (
              <span className="text-danger"> · <strong>{bulkResult.channelsFailed} failed</strong></span>
            )}
            {bulkResult.channelsSkipped > 0 && (
              <span className="text-text-muted"> · <strong>{bulkResult.channelsSkipped} skipped</strong></span>
            )}
          </span>
          <button type="button" onClick={() => setBulkResult(null)} className="btn-ghost text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI strip */}
      <KpiStrip refreshKey={mutationTick} />

      {/* Main inbox layout: sidebar / list / detail */}
      <div className="flex gap-3 items-start">
        <SmartSegments
          active={activeSegment}
          segmentCounts={segmentCounts}
          bucketCounts={bucketCounts}
          activeBuckets={bucketFilter}
          onSegmentClick={selectSegment}
          onBucketClick={toggleBucketFilter}
        />

        {/* Middle: list */}
        <main className="flex-1 min-w-0 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          {/* List header — segments name + search + bulk toolbar */}
          <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-3 min-h-[52px] flex-wrap">
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
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-foreground">{selected.size} dipilih</span>
                <div className="flex gap-1.5 ml-auto flex-wrap">
                  {unreviewedSelectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void runBulkReviewConfirm()}
                      disabled={bulkBusy}
                      className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-medium disabled:opacity-50"
                      title="Tandai klasifikasi sudah benar untuk lead yang belum direview"
                    >
                      <Icon name="check" size={12} /> Konfirmasi klasifikasi ({unreviewedSelectedIds.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSkipAlreadySent(alreadySentIds.length > 0);
                      setBulkConfirmOpen(true);
                    }}
                    disabled={bulkBusy}
                    className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Icon name="send" size={12} /> Reachout
                  </button>
                  <button type="button" onClick={() => setMoveBucketOpen(true)} disabled={bulkBusy} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                    <Icon name="tag" size={12} /> Ubah bucket
                  </button>
                  <button type="button" onClick={() => setAssignInterviewerOpen(true)} disabled={bulkBusy} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                    <Icon name="user" size={12} /> Assign
                  </button>
                  <button type="button" onClick={() => void runBulkReclassify()} disabled={bulkBusy} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                    <Icon name="refresh" size={12} /> Re-classify
                  </button>
                  <button type="button" onClick={runBulkExportCsv} disabled={bulkBusy} className="btn-ghost text-xs inline-flex items-center gap-1.5">
                    <Icon name="download" size={12} /> CSV
                  </button>
                  <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost text-xs">
                    Batal
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">{segmentLabel}</span>
                <span className="text-xs text-text-muted">· {total} lead</span>
                <div className="ml-auto relative w-full sm:w-[320px]">
                  <Icon
                    name="search"
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted-2 pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama, email, kampus…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-elevated/40 border border-border rounded-lg outline-none focus:border-primary"
                  />
                </div>
              </>
            )}
          </div>

          {/* Column headers — grid mirrors LeadInboxRow exactly. The
              `whitespace-nowrap` keeps short labels from wrapping into
              the next column's territory when the table narrows (3-col
              layout with detail panel open). */}
          <div
            className="grid items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-[0.06em] font-semibold text-text-muted-2 border-b border-border/60 bg-surface-elevated/30 whitespace-nowrap"
            style={{
              gridTemplateColumns:
                "20px 28px minmax(80px, 1.4fr) minmax(80px, 1.5fr) 44px 100px 50px 78px 78px",
            }}
          >
            <span />
            <span />
            <span className="truncate">Lead</span>
            <span className="truncate">Target</span>
            <span>Bucket</span>
            <span>Stage</span>
            <span>Engage</span>
            <span className="text-right">Progress</span>
            <span />
          </div>

          {/* Rows */}
          <div className="flex-1 max-h-[calc(100vh-22rem)] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-text-muted">Loading…</div>
            ) : error ? (
              <div className="p-6 text-sm text-danger">Error: {error}</div>
            ) : !data || data.leads.length === 0 ? (
              <div className="p-12 text-center text-sm text-text-muted">
                <Icon name="inbox" size={28} className="opacity-40 mx-auto mb-2" />
                {total === 0 && bucketFilter.size === 0 && stageFilter.size === 0 && !debouncedSearch
                  ? "Belum ada lead. Klik 'Sync Tally' di atas untuk mengimpor."
                  : "Tidak ada lead yang cocok dengan filter."}
              </div>
            ) : (
              data.leads.map((lead) => (
                <div key={lead.id} className="border-b border-border/60/60 last:border-b-0">
                  <LeadInboxRow
                    lead={lead}
                    selected={selected.has(lead.id)}
                    isActive={openLead?.id === lead.id}
                    progress={data.progress[lead.id] ?? { done: 0, total: 0 }}
                    mentorNoteCount={data.mentorNoteCount?.[lead.id] ?? 0}
                    onSelect={() => toggleOne(lead.id)}
                    onOpen={() => setOpenLead(lead)}
                    onReachout={(ch) => void doSingleReachout(lead.id, ch)}
                    onScheduleCall={scheduleCallStub}
                    busy={bulkBusy}
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer pagination */}
          <div className="px-4 py-2.5 border-t border-border/60 flex items-center gap-3 flex-wrap text-xs text-text-muted-2">
            {total > pageSize && (
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
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
                className="btn-ghost text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                <Icon name="chevron-left" size={12} /> Prev
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset(offset + pageSize)}
                className="btn-ghost text-xs px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                Next <Icon name="chevron-right" size={12} />
              </button>
            </div>
          </div>
        </main>

        {/* Right: detail slide-over */}
        {openLead && (
          <LeadDetailPanel
            lead={openLead}
            busy={bulkBusy}
            onClose={() => setOpenLead(null)}
            onReachout={doSingleReachout}
            onDeleted={() => {
              setSyncMsg({ kind: "ok", text: `Lead "${openLead.name}" dihapus.` });
              setTimeout(() => setSyncMsg(null), 4000);
              void fetchList();
              bumpMutationTick();
            }}
            onChanged={() => {
              // Phase 15: review-confirm or panel-side mutation — refresh
              // list + stats so the row + segment counter + nav badge
              // reflect the new state.
              void fetchList();
              bumpMutationTick();
            }}
          />
        )}
      </div>

      {/* Move bucket modal */}
      <Modal
        open={moveBucketOpen}
        onClose={() => (bulkBusy ? null : setMoveBucketOpen(false))}
        title={`Pindahkan ${selected.size} leads ke bucket lain`}
        actions={
          <>
            <button type="button" onClick={() => setMoveBucketOpen(false)} disabled={bulkBusy} className="btn-ghost">
              Batal
            </button>
            <button
              type="button"
              onClick={() => void runBulkChangeBucket()}
              disabled={bulkBusy || !moveBucketTarget || !moveBucketReason.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {bulkBusy ? "Memindahkan…" : "Pindahkan"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-xs text-text-muted">
            Override otomatis classifier. Leads yang sudah di bucket target akan di-skip.
          </p>
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted-2 block mb-1">Target bucket</label>
            <select
              value={moveBucketTarget}
              onChange={(e) => setMoveBucketTarget(e.target.value as LeadBucket | "")}
              className="input-field text-sm"
            >
              <option value="">Pilih bucket…</option>
              {LEAD_BUCKETS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted-2 block mb-1">Justifikasi (wajib)</label>
            <input
              type="text"
              value={moveBucketReason}
              onChange={(e) => setMoveBucketReason(e.target.value)}
              placeholder="mis. Mentor Hungary baru di-onboard, retro-fix..."
              className="input-field text-sm"
            />
          </div>
        </div>
      </Modal>

      {/* Assign interviewer modal */}
      <Modal
        open={assignInterviewerOpen}
        onClose={() => (bulkBusy ? null : setAssignInterviewerOpen(false))}
        title={`Assign interviewer ke ${selected.size} leads`}
        actions={
          <>
            <button type="button" onClick={() => setAssignInterviewerOpen(false)} disabled={bulkBusy} className="btn-ghost">
              Batal
            </button>
            <button
              type="button"
              onClick={() => void runBulkAssignInterviewer()}
              disabled={bulkBusy}
              className="btn-primary disabled:opacity-50"
            >
              {bulkBusy ? "Menyimpan…" : assignInterviewerName.trim() ? "Assign" : "Clear interviewer"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-xs text-text-muted">Kosongkan nama untuk clear interviewer assignment dari leads terpilih.</p>
          <div>
            <label className="text-xs uppercase tracking-wider text-text-muted-2 block mb-1">Interviewer name</label>
            <input
              type="text"
              value={assignInterviewerName}
              onChange={(e) => setAssignInterviewerName(e.target.value)}
              placeholder="mis. Razak, Venzo, …"
              className="input-field text-sm"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Bulk confirm modal */}
      <Modal
        open={bulkConfirmOpen}
        onClose={() => (bulkBusy ? null : setBulkConfirmOpen(false))}
        title={`Reachout ke ${effectiveIds.length} leads?`}
        actions={
          <>
            <button type="button" onClick={() => setBulkConfirmOpen(false)} disabled={bulkBusy} className="btn-ghost">
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
          <div className="text-xs text-text-muted space-y-1">
            <div>
              <strong>{selected.size}</strong> lead terpilih:{" "}
              <span className="text-text-muted-2">
                {Object.entries(bucketBreakdown).map(([b, n]) => `${n} ${b}`).join(" · ")}
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

          {unreviewedSelectedIds.length > 0 && (
            <div className="text-xs text-amber-900 px-3 py-2 rounded bg-amber-50 border border-amber-200">
              ⚠ {unreviewedSelectedIds.length} lead di seleksi <strong>belum direview admin</strong> — akan di-skip backend.
              Konfirmasi klasifikasi dulu (tombol di bulk bar) supaya ikut terkirim.
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-text-muted-2">Channel</label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: "email",    label: "Email",      hint: "Resend" },
                { value: "whatsapp", label: "WhatsApp",   hint: "Fonnte" },
                { value: "both",     label: "Email + WA", hint: "Sequential" },
              ] as const).map((opt) => {
                const isActive = bulkChannel === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBulkChannel(opt.value)}
                    className={`text-xs px-3 py-2 rounded-md border transition text-left ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface hover:border-primary-200"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] text-text-muted-2">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
            {(bulkChannel === "whatsapp" || bulkChannel === "both") && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
                ⚠ Lead tanpa nomor WA atau template WA kosong akan otomatis di-skip untuk channel WA. Channel email tetap dikirim.
              </p>
            )}
          </div>

          <p className="text-[11px] text-text-muted-2 italic">
            Sequential ~250ms per lead. Template (email + WA) dipilih otomatis sesuai bucket masing-masing.
          </p>
        </div>
      </Modal>
    </div>
  );
}
