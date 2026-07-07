"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import type { MentorLeadView } from "@/lib/leads/types";
import { getCached, revalidate } from "@/lib/swr-lite";
import MentorLeadDetailPanel from "@/components/mentor/MentorLeadDetailPanel";
import MentorStatTile from "@/components/mentor/MentorStatTile";
import MentorFilterChip from "@/components/mentor/MentorFilterChip";
import MentorTriageRow from "@/components/mentor/MentorTriageRow";

/**
 * Mentor leads triage stream (Phase 16, replaces Phase 13.1).
 *
 * Layout from top to bottom:
 *   1. Page header (title + 1-line intro)
 *   2. KPI strip — 4 tiles: Hari ini · Cocok negaraku · Admin balas · Saya tandai
 *   3. Semantic filter chips (mutually exclusive): Semua / Cocok negaraku / Admin balas / Saya tandai
 *   4. Country chips (top 5 destinations by count) + long-tail country dropdown + search
 *   5. Time-grouped list (Hari ini / Kemarin / Pekan ini / Lebih lama)
 *   6. Detail slide-over (right column on XL screens, stacked below on mobile)
 *
 * URL syncs:
 *   ?id=<leadId>           — opens detail panel for that lead
 *   ?country=<country>     — country narrow (or "__none__" for "Belum jelas")
 *   ?match=country|unread  — semantic chip state (overrides chip default)
 *   ?flagged=1             — semantic "Saya tandai" chip state
 *
 * Note: chip state is computed from URL params, not local state, so
 * bookmarks survive refresh and shares.
 */
const NONE_KEY = "__none__";

type SemanticChip = "all" | "match_country" | "match_unread" | "flagged";

interface ListResponse {
  leads: MentorLeadView[];
  total: number;
  countryCounts: Record<string, number>;
  stats: {
    totalAll: number;
    totalToday: number;
    matchMyCountry: number;
    unreadReplies: number;
    flagged: number;
  };
  mentorCountry: string | null;
}

/** Bucket the leads by time-of-submission. Boundaries roughly map to:
 *  Hari ini (< 12h), Kemarin (12–36h), Pekan ini (36–168h = 7d), Lebih
 *  lama (>168h). These are intentionally loose — calendar boundaries
 *  would shift the buckets as the day flips, this version stays stable
 *  across a single session. */
function groupByTime(leads: MentorLeadView[]) {
  const today: MentorLeadView[] = [];
  const yesterday: MentorLeadView[] = [];
  const week: MentorLeadView[] = [];
  const older: MentorLeadView[] = [];
  const nowMs = Date.now();
  for (const l of leads) {
    if (!l.submittedAt) { older.push(l); continue; }
    const ageH = (nowMs - new Date(l.submittedAt).getTime()) / 3_600_000;
    if (ageH <= 12) today.push(l);
    else if (ageH <= 36) yesterday.push(l);
    else if (ageH <= 168) week.push(l);
    else older.push(l);
  }
  return [
    { id: "today",     label: "Hari ini",   accent: "text-primary",      leads: today },
    { id: "yesterday", label: "Kemarin",    accent: "text-text-muted-3", leads: yesterday },
    { id: "week",      label: "Pekan ini",  accent: "text-text-muted-3", leads: week },
    { id: "older",     label: "Lebih lama", accent: "text-text-muted-2", leads: older },
  ] as const;
}

export default function MentorLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOpenId = searchParams.get("id");
  const initialCountry = searchParams.get("country");
  const initialMatch = searchParams.get("match"); // "country" | "unread" | null
  const initialFlagged = searchParams.get("flagged") === "1";

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Phase 16 UX fix: track whether we've ever returned data. Subsequent
  // refetches (e.g. after the mentor flags a lead or writes a note) keep
  // showing the previous list while the new data arrives, instead of
  // replacing it with a skeleton — which felt jarring after every
  // detail-panel interaction.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter state. `chip` is the active semantic chip; `country` is the
  // independent country narrow (composable with `chip`).
  const [chip, setChip] = useState<SemanticChip>(() => {
    if (initialMatch === "country") return "match_country";
    if (initialMatch === "unread") return "match_unread";
    if (initialFlagged) return "flagged";
    return "all";
  });
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [openLeadId, setOpenLeadId] = useState<string | null>(initialOpenId);

  // Debounce search 300ms (same as Phase 13.1).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // URL sync — keep ?id, ?country, ?match, ?flagged in the URL so deep
  // links survive refresh + can be shared.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (openLeadId) sp.set("id", openLeadId);
    if (country) sp.set("country", country);
    if (chip === "match_country") sp.set("match", "country");
    else if (chip === "match_unread") sp.set("match", "unread");
    else if (chip === "flagged") sp.set("flagged", "1");
    const qs = sp.toString();
    const currentQs = searchParams.toString();
    if (qs === currentQs) return; // no-op
    router.replace(`/dashboard/leads${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [openLeadId, country, chip, router, searchParams]);

  const fetchList = useCallback(async () => {
    setErr(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (country) params.set("country", country);
    if (chip === "flagged") params.set("flaggedOnly", "1");
    else if (chip === "match_country") params.set("match", "country");
    else if (chip === "match_unread") params.set("match", "unread");
    params.set("limit", "200");
    const url = `/api/mentor/leads?${params.toString()}`;

    // Stale-while-revalidate: paint the cached list instantly (also fed by the
    // layout's idle prefetch), then refresh in the background. This was the
    // "Leads tab loads forever" complaint — it refetched from zero every visit.
    const cached = getCached<ListResponse>(url);
    if (cached) {
      setData(cached);
      setHasLoadedOnce(true);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const json = await revalidate<ListResponse>(url);
      if (json) {
        setData(json);
        setHasLoadedOnce(true);
      } else if (!cached) {
        setErr("Gagal memuat leads — coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, country, chip]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const stats = data?.stats ?? { totalAll: 0, totalToday: 0, matchMyCountry: 0, unreadReplies: 0, flagged: 0 };
  const mentorCountry = data?.mentorCountry ?? null;
  const groups = useMemo(() => groupByTime(data?.leads ?? []), [data?.leads]);

  /** All known destination countries sorted by count desc, then alpha.
   *  Rendered as a horizontally-scrollable chip strip — countries that
   *  don't fit get hidden behind the scroll edge but stay reachable. */
  const allCountryChips = useMemo(() => {
    const counts = data?.countryCounts ?? {};
    return Object.entries(counts)
      .filter(([k]) => k !== NONE_KEY)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data?.countryCounts]);

  /** Same list (used by the long-tail dropdown). Aliased for readability
   *  at the call site — same content as the chip strip, just rendered
   *  differently. */
  const allCountryOptions = allCountryChips;
  const noneCount = data?.countryCounts?.[NONE_KEY] ?? 0;
  const totalCountedAcrossCountries = useMemo(
    () => Object.values(data?.countryCounts ?? {}).reduce((a, b) => a + b, 0),
    [data?.countryCounts],
  );

  function pickChip(next: SemanticChip) {
    // Single source of truth: clicking the active chip clears back to "all".
    setChip((prev) => (prev === next ? "all" : next));
  }

  function pickCountry(next: string | null) {
    setCountry((prev) => (prev === next ? null : next));
  }

  /** Open a lead's detail panel. Phase 16 UX fix: optimistically clear
   *  the unread-admin-reply badge for this lead + decrement the KPI tile
   *  so the inbox responds instantly to the click. The server-side
   *  mark-viewed (fired by the detail panel on mount) makes the change
   *  durable; no list refetch needed. */
  function openLead(leadId: string) {
    setData((prev) => {
      if (!prev) return prev;
      const lead = prev.leads.find((l) => l.id === leadId);
      if (!lead?.hasUnreadAdminReply) return prev;
      return {
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === leadId ? { ...l, hasUnreadAdminReply: false } : l,
        ),
        stats: {
          ...prev.stats,
          unreadReplies: Math.max(0, prev.stats.unreadReplies - 1),
        },
      };
    });
    setOpenLeadId(leadId);
  }

  const filtersActive =
    chip !== "all" || country !== null || debouncedSearch.length > 0;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between gap-3 flex-wrap" data-tour-screen="leads">
        <div>
          <h1 className="sesi-title">
            Leads <span className="lede">dari pendaftaran.</span>
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            {data?.total ?? 0} pendaftaran dari landing page. Tandai yang kamu kenal — admin kerjakan sisanya.
            <span
              className="ml-1.5 text-primary font-medium inline-flex items-center gap-1 cursor-help align-middle"
              title="Kamu lihat semua lead masuk untuk transparansi. Tandai mereka yang kamu kenal personal (alumni almamater, teman LPDP batch, dll), atau tinggalkan catatan supaya admin punya konteks tambahan saat outreach."
            >
              <Icon name="info" size={11} /> apa peranku?
            </span>
          </p>
        </div>
      </div>

      {/* KPI strip — clickable shortcuts to filter chips */}
      <div className="flex gap-2.5 flex-wrap">
        <MentorStatTile
          label="Jumlah leads total"
          value={stats.totalAll}
          hint={stats.totalToday > 0 ? `${stats.totalToday} masuk hari ini` : undefined}
          icon="inbox"
          accent="primary"
          active={chip === "all" && country === null}
        />
        <MentorStatTile
          label="Sama dengan negara studiku"
          value={stats.matchMyCountry}
          hint={mentorCountry ? mentorCountry : "profil belum lengkap"}
          icon="sparkles"
          accent="violet"
          active={chip === "match_country"}
          onClick={mentorCountry ? () => pickChip("match_country") : undefined}
        />
        <MentorStatTile
          label="Admin balas catatanmu"
          value={stats.unreadReplies}
          hint={stats.unreadReplies > 0 ? "belum kamu lihat" : "tidak ada"}
          icon="chat"
          accent="amber"
          active={chip === "match_unread"}
          onClick={() => pickChip("match_unread")}
        />
        <MentorStatTile
          label="Sudah kamu tandai"
          value={stats.flagged}
          hint={stats.flagged > 0 ? "kamu kenal personal" : undefined}
          icon="flag"
          accent="orange"
          active={chip === "flagged"}
          onClick={() => pickChip("flagged")}
        />
      </div>

      {/* Semantic chips (mutually exclusive) */}
      <div className="flex gap-2 flex-wrap items-center">
        <MentorFilterChip
          label="Semua"
          count={data?.total}
          active={chip === "all"}
          onClick={() => pickChip("all")}
        />
        <MentorFilterChip
          label="Sama dengan negara studiku"
          count={stats.matchMyCountry}
          icon="sparkles"
          active={chip === "match_country"}
          onClick={mentorCountry ? () => pickChip("match_country") : undefined}
          disabled={!mentorCountry}
          title={mentorCountry ? `Lead yang menargetkan ${mentorCountry}` : "Profil mentor belum melaporkan negara — minta admin update MENTOR_USER_COUNTRY"}
        />
        <MentorFilterChip
          label="Admin balas"
          count={stats.unreadReplies}
          dot={stats.unreadReplies > 0 ? "#dc2626" : undefined}
          active={chip === "match_unread"}
          onClick={() => pickChip("match_unread")}
        />
        <MentorFilterChip
          label="Saya tandai"
          count={stats.flagged}
          icon="flag"
          active={chip === "flagged"}
          onClick={() => pickChip("flagged")}
        />
      </div>

      {/* Country chips — every destination + the "Belum jelas" bucket so
          all 148 leads are reachable via chips. Horizontally scrollable
          when there are more chips than viewport width allows. The
          TARGET label stays anchored on the left (doesn't scroll with
          the chips) by sitting outside the scroll container. The
          scrollbar itself is hidden visually for a cleaner inbox feel —
          mentor still scrolls via trackpad / shift+wheel / drag. */}
      {(allCountryChips.length > 0 || noneCount > 0) && (
        <div className="flex gap-2 items-center">
          <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted-2 flex-shrink-0">
            Target
          </span>
          <div
            className="flex gap-2 items-center overflow-x-auto flex-1 min-w-0 pb-1 -mb-1"
            style={{ scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}
          >
            {allCountryChips.map(([c, n]) => (
              <MentorFilterChip
                key={c}
                label={c}
                count={n}
                active={country === c}
                onClick={() => pickCountry(c)}
              />
            ))}
            {noneCount > 0 && (
              <MentorFilterChip
                label="Belum jelas"
                count={noneCount}
                active={country === NONE_KEY}
                onClick={() => pickCountry(NONE_KEY)}
                title="Lead yang classifier belum bisa deteksi negaranya"
              />
            )}
          </div>
        </div>
      )}

      {/* Search + long-tail country dropdown */}
      <div className="card p-2.5 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Icon
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-2 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, target kampus…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={country ?? ""}
          onChange={(e) => pickCountry(e.target.value || null)}
          className="text-sm bg-surface border border-border rounded-lg px-2.5 py-2 text-foreground hover:border-primary-200 focus:outline-none focus:border-primary"
          title="Filter berdasarkan negara tujuan lead (semua negara, termasuk yang tidak masuk top-5 chip di atas)"
        >
          <option value="">Semua negara ({totalCountedAcrossCountries})</option>
          {allCountryOptions.map(([c, n]) => (
            <option key={c} value={c}>{c} ({n})</option>
          ))}
          {noneCount > 0 && (
            <option value={NONE_KEY}>Belum jelas ({noneCount})</option>
          )}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={() => { setChip("all"); setCountry(null); setSearch(""); }}
            className="text-xs text-primary hover:underline"
            title="Bersihkan semua filter aktif"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Split layout: time-grouped list (left) + detail panel (right) */}
      <div className="flex gap-3 items-start flex-col xl:flex-row">
        <div className="card p-0 overflow-hidden flex-1 min-w-0 w-full">
          {loading && !hasLoadedOnce ? (
            <div className="p-4"><SkeletonTable rows={5} /></div>
          ) : err && !hasLoadedOnce ? (
            <div className="p-6 text-sm text-danger">Error: {err}</div>
          ) : !data || data.leads.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-muted">
              <Icon name="inbox" size={28} className="opacity-40 mx-auto mb-2" />
              {chip === "flagged"
                ? "Belum ada lead yang kamu tandai."
                : chip === "match_country"
                  ? mentorCountry
                    ? `Belum ada lead masuk untuk ${mentorCountry}.`
                    : "Negara studimu belum di-set. Minta admin tambah email kamu ke MENTOR_USER_COUNTRY."
                  : chip === "match_unread"
                    ? "Tidak ada admin reply yang belum kamu lihat. 🎉"
                    : country
                      ? "Belum ada lead untuk negara ini."
                      : debouncedSearch
                        ? "Tidak ada lead yang cocok."
                        : "Belum ada lead."}
            </div>
          ) : (
            groups.map((g) => {
              if (g.leads.length === 0) return null;
              return (
                <div key={g.id}>
                  <div className="flex items-center gap-2.5 px-4 pt-4 pb-2 border-t border-border/40 first:border-t-0">
                    <span className={`text-[10.5px] font-bold uppercase tracking-[0.08em] ${g.accent}`}>
                      {g.label}
                    </span>
                    <span className="text-[10.5px] font-semibold text-text-muted-2 bg-surface-elevated/60 px-1.5 py-px rounded-full tabular-nums">
                      {g.leads.length}
                    </span>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <ul className="divide-y divide-border/40">
                    {g.leads.map((lead) => (
                      <li key={lead.id}>
                        <MentorTriageRow
                          lead={lead}
                          isActive={openLeadId === lead.id}
                          onClick={() => openLead(lead.id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        {openLeadId && (
          <MentorLeadDetailPanel
            leadId={openLeadId}
            onClose={() => setOpenLeadId(null)}
            onChanged={fetchList}
          />
        )}
      </div>
    </div>
  );
}
