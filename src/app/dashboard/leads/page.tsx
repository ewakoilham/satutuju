"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatJakartaDateTime, formatJakartaRelative } from "@/lib/datetime-id";
import { fundingPlanLabelId, type MentorLeadView } from "@/lib/leads/types";
import MentorLeadDetailPanel from "@/components/mentor/MentorLeadDetailPanel";

/**
 * Mentor-side leads inbox — Phase 13.1 split layout.
 *
 * Left: scrollable list of all incoming leads (Tally-derived rows
 * stripped of admin-only fields).
 * Right: detail panel (mounted when a lead is selected). Clicking
 * different rows swaps the panel content without page navigation;
 * scrolling the list doesn't reset typed-but-unsaved drafts.
 *
 * URL syncs to `?id=<leadId>` so mentors can bookmark / share a lead.
 * Direct `/dashboard/leads/[id]` URLs redirect here with the param.
 */
const NONE_KEY = "__none__";

export default function MentorLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOpenId = searchParams.get("id");
  const initialCountry = searchParams.get("country");

  const [leads, setLeads] = useState<MentorLeadView[] | null>(null);
  const [total, setTotal] = useState(0);
  const [countryCounts, setCountryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [country, setCountry] = useState<string | null>(initialCountry);
  const [openLeadId, setOpenLeadId] = useState<string | null>(initialOpenId);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keep ?id= and ?country= in sync with state. Replace history (don't
  // push) so row clicks + dropdown changes don't bloat browser history.
  useEffect(() => {
    const currentId = searchParams.get("id");
    const currentCountry = searchParams.get("country");
    if (openLeadId === currentId && (country ?? null) === (currentCountry ?? null)) return;
    const sp = new URLSearchParams(searchParams.toString());
    if (openLeadId) sp.set("id", openLeadId);
    else sp.delete("id");
    if (country) sp.set("country", country);
    else sp.delete("country");
    const qs = sp.toString();
    router.replace(`/dashboard/leads${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [openLeadId, country, router, searchParams]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (flaggedOnly) params.set("flaggedOnly", "1");
    if (country) params.set("country", country);
    params.set("limit", "100");
    try {
      const res = await fetch(`/api/mentor/leads?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setLeads(json.leads ?? []);
      setTotal(json.total ?? 0);
      setCountryCounts(json.countryCounts ?? {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, flaggedOnly, country]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  const flaggedCount = useMemo(
    () => (leads ?? []).filter((l) => l.flaggedByMe).length,
    [leads],
  );

  /** Country dropdown options sorted by count desc, then alpha. The
   *  "Belum jelas" bucket (NONE_KEY) is pinned to the bottom regardless
   *  of count so it doesn't clutter the natural country list. */
  const countryOptions = useMemo(() => {
    const entries = Object.entries(countryCounts).filter(([k]) => k !== NONE_KEY);
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return entries;
  }, [countryCounts]);
  const noneCount = countryCounts[NONE_KEY] ?? 0;
  const totalCounted = useMemo(
    () => Object.values(countryCounts).reduce((a, b) => a + b, 0),
    [countryCounts],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
          Leads
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-2xl">
          Lihat semua lead yang masuk dari pendaftaran via landing page. Kalau
          kamu kenal lead-nya secara personal, tandai untuk kasih konteks
          tambahan ke admin. Kamu juga bisa tinggalin catatan — admin bakal
          lihat dan bisa balas langsung.
        </p>
      </div>

      {/* Toolbar */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
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
          onChange={(e) => setCountry(e.target.value || null)}
          className="text-sm bg-surface border border-border rounded-lg px-2.5 py-2 text-foreground hover:border-primary-200 focus:outline-none focus:border-primary"
          title="Filter berdasarkan negara tujuan lead"
        >
          <option value="">Semua negara ({totalCounted})</option>
          {countryOptions.map(([c, n]) => (
            <option key={c} value={c}>{c} ({n})</option>
          ))}
          {noneCount > 0 && (
            <option value={NONE_KEY}>Belum jelas ({noneCount})</option>
          )}
        </select>
        <label className="inline-flex items-center gap-2 text-xs text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
            className="accent-primary"
          />
          <span>Hanya yang saya tandai{flaggedCount > 0 && ` (${flaggedCount})`}</span>
        </label>
        <span className="text-xs text-text-muted-2 tabular-nums ml-auto">
          {total} lead
        </span>
      </div>

      {/* Split layout */}
      <div className="flex gap-3 items-start flex-col xl:flex-row">
        {/* Left: list */}
        <div className="card p-0 overflow-hidden flex-1 min-w-0 w-full">
          {loading ? (
            <div className="p-4"><SkeletonTable rows={5} /></div>
          ) : err ? (
            <div className="p-6 text-sm text-danger">Error: {err}</div>
          ) : !leads || leads.length === 0 ? (
            <div className="p-12 text-center text-sm text-text-muted">
              <Icon name="inbox" size={28} className="opacity-40 mx-auto mb-2" />
              {flaggedOnly
                ? "Belum ada lead yang kamu tandai."
                : country
                  ? "Belum ada lead untuk negara ini."
                  : debouncedSearch
                    ? "Tidak ada lead yang cocok."
                    : "Belum ada lead."}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {leads.map((l) => {
                const isActive = openLeadId === l.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setOpenLeadId(l.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition ${
                        isActive
                          ? "bg-primary-50/60 border-l-2 border-l-primary"
                          : "hover:bg-surface-elevated/40 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {l.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">{l.name}</span>
                          {l.flaggedByMe && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Icon name="flag" size={9} /> Saya tandai
                            </span>
                          )}
                          {l.noteCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold bg-primary-50 text-primary">
                              <Icon name="chat" size={9} /> {l.noteCount} catatan
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted truncate">{l.email}</div>
                        <div className="text-xs text-text-muted-2 mt-0.5 truncate">
                          {l.targetCampusAndProgram || "(target tidak diisi)"} ·{" "}
                          {fundingPlanLabelId(l.fundingPlan)}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-text-muted-2 whitespace-nowrap flex-shrink-0">
                        <div title={l.submittedAt ? formatJakartaDateTime(l.submittedAt) : ""}>
                          {l.submittedAt ? formatJakartaRelative(l.submittedAt) : "—"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right: detail panel */}
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
