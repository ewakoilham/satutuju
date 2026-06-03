"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import { SkeletonTable } from "@/components/ui/Skeleton";
import * as AllFlags from "country-flag-icons/react/3x2";
import { enrichUniversity, estimateUniStats } from "@/data/university-enrichment";

// ISO 3166-1 alpha-2 codes mapped to country names used in the data
const COUNTRY_CODES: Record<string, string> = {
  Australia: "AU", Austria: "AT", Belgium: "BE", Canada: "CA",
  China: "CN", Croatia: "HR", Cyprus: "CY", "Czech Republic": "CZ",
  Finland: "FI", France: "FR", Georgia: "GE", Germany: "DE",
  Greece: "GR", Grenada: "GD", "Hong Kong": "HK", Hungary: "HU",
  India: "IN", Indonesia: "ID", Ireland: "IE", Italy: "IT",
  Japan: "JP", Kazakhstan: "KZ", Latvia: "LV", Lithuania: "LT",
  Malaysia: "MY", Malta: "MT", Mauritius: "MU", Monaco: "MC",
  Netherlands: "NL", "New Zealand": "NZ", Philippines: "PH",
  Poland: "PL", Portugal: "PT", Romania: "RO", Russia: "RU",
  Singapore: "SG", "South Korea": "KR", Spain: "ES", "Sri Lanka": "LK",
  Sweden: "SE", Switzerland: "CH", Thailand: "TH", Turkey: "TR",
  UAE: "AE", UK: "GB", USA: "US", Vietnam: "VN",
};

function FlagIcon({ code, className = "w-5 h-auto rounded-sm" }: { code: string; className?: string }) {
  const Flag = (AllFlags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];
  if (!Flag) return null;
  return <Flag className={className} />;
}

function UniFlag({ country, logo, name }: { country: string; logo?: string; name?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className="uni-flag"><img src={logo} alt={name || country} /></span>;
  }
  const code = COUNTRY_CODES[country];
  return <span className="uni-flag">{code ? <FlagIcon code={code} /> : <span>🌍</span>}</span>;
}

interface University {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
  commissionNote?: string;
  commissionFee?: string;
  agency?: string;
  programs?: string;
}

interface MenteeLite {
  id: string;
  name: string;
  target?: string | null;
  destinations?: string | null;
}

const DEGREE_OPTIONS = [
  "Undergraduate",
  "Graduate",
  "English Language",
  "English Language / Foundation",
  "Summer Programs",
  "All",
];

const DEGREE_LABELS: Record<string, string> = {
  Undergraduate: "Undergraduate / Bachelor",
  Graduate: "Postgraduate / Master",
  "English Language": "English Language",
  "English Language / Foundation": "English Language / Foundation",
  "Summer Programs": "Summer Programs",
  All: "All Programs",
};

const REGION_TABS: { key: string; label: string; code?: string; emoji?: string }[] = [
  { key: "", label: "Semua", emoji: "🌐" },
  { key: "au-nz", label: "AU & NZ", code: "AU" },
  { key: "uk", label: "UK", code: "GB" },
  { key: "us", label: "USA", code: "US" },
  { key: "canada", label: "Kanada", code: "CA" },
  { key: "europe", label: "Eropa", emoji: "🌍" },
  { key: "asia", label: "Asia", emoji: "🌏" },
  { key: "others", label: "Lainnya", emoji: "📍" },
];

const REGION_COUNTRY_MAP: Record<string, string[]> = {
  "au-nz": ["Australia", "New Zealand"],
  uk: ["UK"],
  us: ["USA"],
  canada: ["Canada"],
  europe: [
    "Austria","Belgium","Croatia","Cyprus","Czech Republic","Finland","France",
    "Georgia","Germany","Greece","Hungary","Ireland","Italy","Latvia","Lithuania",
    "Malta","Monaco","Netherlands","Poland","Portugal","Romania","Russia","Spain",
    "Sweden","Switzerland","Turkey",
  ],
  asia: [
    "China","Hong Kong","India","Indonesia","Japan","Kazakhstan","Malaysia",
    "Philippines","Singapore","South Korea","Sri Lanka","Thailand","Vietnam",
  ],
  others: ["Caribbean","Grenada","Mauritius","UAE","West Indies"],
};

const ALL_COUNTRIES = [
  "Australia","Austria","Belgium","Canada","Caribbean","China","Croatia","Cyprus",
  "Czech Republic","Finland","France","Georgia","Germany","Greece","Grenada",
  "Hong Kong","Hungary","India","Indonesia","Ireland","Italy","Japan","Kazakhstan",
  "Latvia","Lithuania","Malaysia","Malta","Mauritius","Monaco","Netherlands",
  "New Zealand","Philippines","Poland","Portugal","Romania","Russia","Singapore",
  "South Korea","Spain","Sri Lanka","Sweden","Switzerland","Thailand","Turkey",
  "UAE","UK","USA","Vietnam","West Indies",
];

const PAGE_SIZE = 20;
const MAX_COMPARE = 4;
const WISHLIST_KEY = "kampus-wishlist";

export default function UniversitiesPage() {
  const { user } = useUser();
  const isAdmin = user?.role === "admin";

  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("az");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Wishlist (localStorage) + compare selection (in-memory) + modals.
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [menteeOpen, setMenteeOpen] = useState(false);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);

  // Admin edit state: universityId -> pending degreeLevel
  const [editingLevel, setEditingLevel] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUniversities = useCallback((q: string, r: string, c: string, l: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (r) params.set("region", r);
    if (c) params.set("country", c);
    if (l) params.set("level", l);

    fetch(`/api/universities?${params}`)
      .then((res) => res.json())
      .then((d) => {
        setUniversities(d.universities || []);
        setTotal(d.total || 0);
        setPage(1);
        setExpandedId(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUniversities("", "", "", ""); }, [fetchUniversities]);

  // Load wishlist from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (raw) setWishlist(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  // Load mentees (for "Cocokkan untuk mentee").
  useEffect(() => {
    let cancelled = false;
    fetch("/api/pairings")
      .then((r) => (r.ok ? r.json() : { pairings: [] }))
      .then((d) => {
        if (cancelled) return;
        const list: MenteeLite[] = (d.pairings || []).map(
          (p: { mentee?: { id: string; name: string }; menteeProfile?: { intendedStudyProgram?: string; preferredDestinations?: string } }) => ({
            id: p.mentee?.id || "",
            name: p.mentee?.name || "Mentee",
            target: p.menteeProfile?.intendedStudyProgram || null,
            destinations: p.menteeProfile?.preferredDestinations || null,
          }),
        );
        setMentees(list.filter((m) => m.id));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUniversities(value, region, country, level), 350);
  }

  function handleRegion(r: string) {
    setRegion(r);
    setCountry("");
    fetchUniversities(search, r, "", level);
  }

  function handleCountry(c: string) {
    setCountry(c);
    fetchUniversities(search, region, c, level);
  }

  function handleLevel(l: string) {
    setLevel(l);
    fetchUniversities(search, region, country, l);
  }

  function clearFilters() {
    setSearch(""); setRegion(""); setCountry(""); setLevel("");
    fetchUniversities("", "", "", "");
  }

  function toggleWishlist(id: number) {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(WISHLIST_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleCompare(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  function matchMentee(m: MenteeLite) {
    setMenteeOpen(false);
    const q = (m.target || "").trim();
    setSearch(q);
    // Try to map a preferred destination to a known country for the filter.
    const dest = (m.destinations || "").trim();
    const matchedCountry = ALL_COUNTRIES.find((c) => dest.toLowerCase().includes(c.toLowerCase())) || "";
    setCountry(matchedCountry);
    setRegion("");
    fetchUniversities(q, "", matchedCountry, level);
  }

  async function saveLevel(u: University) {
    const newLevel = editingLevel[u.id];
    if (!newLevel || newLevel === u.degreeLevel) return;
    setSavingId(u.id);
    try {
      const res = await fetch("/api/universities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId: u.id, degreeLevel: newLevel }),
      });
      if (res.ok) {
        setUniversities((prev) =>
          prev.map((x) => x.id === u.id ? { ...x, degreeLevel: newLevel } : x)
        );
        setEditingLevel((prev) => { const n = { ...prev }; delete n[u.id]; return n; });
        setSavedId(u.id);
        setTimeout(() => setSavedId(null), 2000);
      }
    } finally {
      setSavingId(null);
    }
  }

  // Countries shown in dropdown -- scoped to active region tab
  const visibleCountries = region ? (REGION_COUNTRY_MAP[region] || ALL_COUNTRIES) : ALL_COUNTRIES;

  // Client-side sort over the server-filtered set.
  const sorted = useMemo(() => {
    const arr = [...universities];
    arr.sort((a, b) =>
      sort === "za" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
    return arr;
  }, [universities, sort]);

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const hasFilters = !!(search || region || country || level);
  const regionLabel = REGION_TABS.find((t) => t.key === region)?.label;

  const selectedUnis = selected
    .map((id) => universities.find((u) => u.id === id))
    .filter((u): u is University => !!u);
  const wishlistUnis = universities.filter((u) => wishlist.has(u.id));

  // Sebaran negara — top countries in the current result set.
  const countrySpread = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of universities) counts[u.country] = (counts[u.country] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [universities]);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Direktori kampus mitra</div>
          <h1 className="sesi-title">
            Kampus <span className="lede">— {total.toLocaleString("id-ID")} pintu masuk.</span>
          </h1>
          <p className="sesi-sub">
            Cari kampus berdasarkan negara, jenjang, atau jurusan — atau cocokkan langsung untuk mentee tertentu. Centang sampai {MAX_COMPARE} kampus untuk dibandingkan.
          </p>
        </div>
      </div>

      {/* ── Quick stats ──────────────────────────────────────────── */}
      <div className="kampus-stats">
        <div className="kampus-stat">
          <div className="ico"><Icon name="graduation" size={18} /></div>
          <div>
            <div className="lbl">Kampus</div>
            <div className="val">{total.toLocaleString("id-ID")}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico"><Icon name="map" size={18} /></div>
          <div>
            <div className="lbl">Negara</div>
            <div className="val">{ALL_COUNTRIES.length}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico"><Icon name="book" size={18} /></div>
          <div>
            <div className="lbl">Jenjang</div>
            <div className="val">{DEGREE_OPTIONS.length}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico"><Icon name="star" size={18} /></div>
          <div>
            <div className="lbl">Tersimpan</div>
            <div className="val">{wishlist.size}</div>
          </div>
        </div>
      </div>

      {/* ── Search + filters ─────────────────────────────────────── */}
      <div className="filter-block">
        <div className="search-lg" style={{ marginTop: 24 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
          </svg>
          <input
            placeholder="Cari nama kampus, negara, atau jurusan…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="kbd" style={{ cursor: "pointer" }} onClick={() => handleSearch("")}>✕</button>
          )}
        </div>

        <div className="filter-row-2">
          <span className="label-inline">Negara</span>
          {REGION_TABS.map((t) => (
            <button
              type="button"
              key={t.key || "all"}
              className={`db-pill ${region === t.key ? "on" : ""}`}
              onClick={() => handleRegion(t.key)}
            >
              <span className="flag-emoji">{t.code ? <FlagIcon code={t.code} className="w-4 h-auto rounded-sm inline-block align-middle" /> : t.emoji}</span> {t.label}
            </button>
          ))}
          <span className="divider" />
          <Select
            value={level}
            onChange={(v) => handleLevel(v)}
            options={[
              { value: "", label: "Semua jenjang" },
              ...DEGREE_OPTIONS.map((o) => ({ value: o, label: DEGREE_LABELS[o] || o })),
            ]}
            className="w-auto"
          />
          {region && (
            <Select
              value={country}
              onChange={(v) => handleCountry(v)}
              options={[
                { value: "", label: "Semua negara" },
                ...visibleCountries.map((c) => ({ value: c, label: c })),
              ]}
              className="w-auto"
            />
          )}
        </div>
      </div>

      {/* ── Result bar ───────────────────────────────────────────── */}
      <div className="result-bar">
        <div className="count">
          <b>{loading ? "…" : sorted.length.toLocaleString("id-ID")}</b> <span className="unit">kampus</span>
        </div>
        <div className="applied">
          {search && <span className="applied-chip">{search} <span className="x" onClick={() => handleSearch("")}>✕</span></span>}
          {regionLabel && region && <span className="applied-chip">{regionLabel} <span className="x" onClick={() => handleRegion("")}>✕</span></span>}
          {country && <span className="applied-chip">{country} <span className="x" onClick={() => handleCountry("")}>✕</span></span>}
          {level && <span className="applied-chip">{DEGREE_LABELS[level] || level} <span className="x" onClick={() => handleLevel("")}>✕</span></span>}
          {hasFilters && (
            <button type="button" className="db-btn-ghost" style={{ fontSize: 12, padding: "2px 8px" }} onClick={clearFilters}>
              Bersihkan semua
            </button>
          )}
        </div>
        <div className="sort" style={{ marginLeft: "auto" }}>
          <span>Urut</span>
          <Select
            value={sort}
            onChange={(v) => setSort(v)}
            options={[{ value: "az", label: "Alfabet A–Z" }, { value: "za", label: "Alfabet Z–A" }]}
            className="w-auto"
          />
        </div>
      </div>

      <p className="est-legend">
        <span className="est-star">*</span> Estimasi biaya, IELTS &amp; intake berdasarkan negara &amp; jenjang — selalu cek situs resmi kampus untuk angka pasti. QS rank &amp; logo bersifat aktual.
      </p>

      {/* ── Split layout ─────────────────────────────────────────── */}
      <div className="uni-split">
        <div className="uni-list">
          {loading ? (
            <SkeletonTable rows={6} cols={4} />
          ) : sorted.length === 0 ? (
            <div className="kampus-side-card" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Tidak ada kampus yang cocok.</p>
              <button type="button" className="db-btn db-btn-outline" style={{ marginTop: 12 }} onClick={clearFilters}>
                Bersihkan filter
              </button>
            </div>
          ) : (
            paginated.map((u) => {
              const isSel = selected.includes(u.id);
              const isSaved = wishlist.has(u.id);
              const isExpanded = expandedId === u.id;
              const pendingLevel = editingLevel[u.id] ?? u.degreeLevel;
              const isDirty = editingLevel[u.id] && editingLevel[u.id] !== u.degreeLevel;
              const enr = enrichUniversity(u.name);
              const est = estimateUniStats(u.country, u.degreeLevel);
              return (
                <div key={u.id} className={`uni-card ${isSel ? "featured" : ""}`}>
                  <div className="uni-top">
                    <UniFlag country={u.country} logo={enr?.logo} name={u.name} />
                    <div className="uni-info" style={{ cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : u.id)}>
                      <h3 className="uni-name">{u.name}</h3>
                      <div className="uni-place">
                        {enr?.location || u.country} · {DEGREE_LABELS[u.degreeLevel] || u.degreeLevel}
                        {enr?.qsRank ? ` · QS #${enr.qsRank}` : ""}
                      </div>
                    </div>
                    <div className="uni-actions">
                      <button
                        type="button"
                        className={`iconbtn-sm ${isSel ? "on" : ""}`}
                        title={isSel ? "Batal bandingkan" : selected.length >= MAX_COMPARE ? `Maksimal ${MAX_COMPARE}` : "Bandingkan"}
                        onClick={() => toggleCompare(u.id)}
                        disabled={!isSel && selected.length >= MAX_COMPARE}
                      >
                        {isSel ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`iconbtn-sm ${isSaved ? "on" : ""}`}
                        title={isSaved ? "Tersimpan" : "Simpan ke wishlist"}
                        onClick={() => toggleWishlist(u.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                      </button>
                      {u.website && (
                        <a
                          className="iconbtn-sm"
                          title="Website kampus"
                          href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></svg>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="uni-meta">
                    <div className="cell">
                      <div className="lbl">Estimasi biaya/th <span className="est-star">*</span></div>
                      <div className="val">{est.tuition || "—"}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">IELTS <span className="est-star">*</span></div>
                      <div className="val">{est.ielts || "—"}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">Intake <span className="est-star">*</span></div>
                      <div className="val">{est.intake || "—"}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">Jenjang</div>
                      <div className="val">{DEGREE_LABELS[u.degreeLevel] || u.degreeLevel}</div>
                    </div>
                  </div>

                  <div className="uni-tags">
                    {enr?.qsRank && <span className="db-pill static accent">QS #{enr.qsRank}</span>}
                    <span className="db-pill static">{DEGREE_LABELS[u.degreeLevel] || u.degreeLevel}</span>
                    {isSaved && <span className="db-pill static accent">★ Tersimpan</span>}
                    {isAdmin && u.agency && <span className="db-pill static">{u.agency}</span>}
                  </div>

                  {/* Expanded detail (website + admin commission/edit) */}
                  {isExpanded && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                      {u.website && (
                        <div>
                          <div className="lbl" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted-2)", marginBottom: 3 }}>Admission website</div>
                          <a href={u.website.startsWith("http") ? u.website : `https://${u.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--primary)", wordBreak: "break-all" }}>{u.website}</a>
                        </div>
                      )}
                      {isAdmin && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="lbl" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--warning)" }}>Edit jenjang</span>
                          <Select
                            value={pendingLevel}
                            onChange={(v) => setEditingLevel((prev) => ({ ...prev, [u.id]: v }))}
                            options={DEGREE_OPTIONS.map((o) => ({ value: o, label: DEGREE_LABELS[o] || o }))}
                            className="w-auto"
                          />
                          {isDirty && (
                            <button type="button" className="db-btn db-btn-primary" style={{ fontSize: 12, padding: "6px 12px" }} disabled={savingId === u.id} onClick={() => saveLevel(u)}>
                              {savingId === u.id ? "Menyimpan…" : "Simpan"}
                            </button>
                          )}
                          {savedId === u.id && <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>✓ Tersimpan</span>}
                        </div>
                      )}
                      {isAdmin && (u.agency || u.commissionFee || u.commissionNote) && (
                        <div style={{ background: "var(--surface-elevated, #f8fafc)", borderRadius: 10, padding: 12 }}>
                          <div className="lbl" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--warning)", marginBottom: 6 }}>Admin · komisi</div>
                          {u.agency && <p style={{ fontSize: 13, margin: "0 0 4px" }}><b>Agency:</b> {u.agency}</p>}
                          {u.commissionFee && <p style={{ fontSize: 13, margin: "0 0 4px", whiteSpace: "pre-wrap" }}><b>Fee:</b> {u.commissionFee}</p>}
                          {u.commissionNote && <p style={{ fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>{u.commissionNote}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Menampilkan {((page - 1) * PAGE_SIZE + 1).toLocaleString("id-ID")}–{Math.min(page * PAGE_SIZE, sorted.length).toLocaleString("id-ID")} dari {sorted.length.toLocaleString("id-ID")}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="db-btn db-btn-outline" disabled={page === 1} onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ padding: "6px 12px" }}>← Sebelumnya</button>
                <button type="button" className="db-btn db-btn-outline" disabled={page === totalPages} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ padding: "6px 12px" }}>Berikutnya →</button>
              </div>
            </div>
          )}

          {/* Compare bar (sticky) */}
          {selected.length > 0 && (
            <div className="compare-bar">
              <div className="count"><span className="num">{selected.length}</span> dipilih</div>
              <div className="who">
                {selectedUnis.map((u) => u.name).join(", ")} · siap dibandingkan side-by-side.
              </div>
              <button type="button" className="btn btn-ghost-d" onClick={() => setSelected([])}>Bersihkan</button>
              <button type="button" className="btn btn-light" onClick={() => setCompareOpen(true)}>Bandingkan →</button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="kampus-side">
          <div className="kampus-side-card" style={{ background: "var(--surface-elevated, #f6f8fc)" }}>
            <span className="db-pill static accent" style={{ marginBottom: 10, display: "inline-block" }}>Quick action</span>
            <h3>Cocokkan untuk mentee</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Pilih mentee — sistem otomatis isi pencarian dari target jurusan & negara tujuan mereka.
            </p>
            <button type="button" className="db-btn db-btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMenteeOpen(true)} disabled={mentees.length === 0}>
              <Icon name="users" size={16} /> {mentees.length === 0 ? "Belum ada mentee" : "Pilih mentee →"}
            </button>
          </div>

          <div className="kampus-side-card">
            <h3>Wishlist kamu</h3>
            {wishlistUnis.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted-2)", margin: 0 }}>
                Belum ada kampus tersimpan. Tekan ☆ di kartu untuk menyimpan.
              </p>
            ) : (
              wishlistUnis.slice(0, 8).map((u) => (
                <div key={u.id} className="row-mini">
                  <span className="name">{u.name}</span>
                  <span className="val" style={{ cursor: "pointer" }} onClick={() => toggleWishlist(u.id)} title="Hapus">{u.country} ✕</span>
                </div>
              ))
            )}
          </div>

          {countrySpread.length > 0 && (
            <div className="kampus-side-card">
              <h3>Sebaran negara</h3>
              {countrySpread.map(([c, n]) => (
                <div key={c} className="row-mini" style={{ cursor: "pointer" }} onClick={() => handleCountry(c)}>
                  <span className="name">{c}</span>
                  <span className="val">{n}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Compare modal ────────────────────────────────────────── */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Bandingkan kampus"
        description={`${selectedUnis.length} kampus dipilih · bandingkan side-by-side.`}
        size="2xl"
        actions={<button type="button" className="db-btn db-btn-primary" onClick={() => setCompareOpen(false)}>Tutup</button>}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-muted-2)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Field</th>
                {selectedUnis.map((u) => (
                  <th key={u.id} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>{u.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { lbl: "Negara", get: (u: University) => u.country },
                { lbl: "Jenjang", get: (u: University) => DEGREE_LABELS[u.degreeLevel] || u.degreeLevel },
                { lbl: "Program", get: (u: University) => u.programs || "—" },
                { lbl: "QS Rank 2025", get: (u: University) => { const e = enrichUniversity(u.name); return e?.qsRank ? `#${e.qsRank}` : "—"; } },
                { lbl: "Estimasi biaya/th *", get: (u: University) => estimateUniStats(u.country, u.degreeLevel).tuition || "—" },
                { lbl: "IELTS *", get: (u: University) => estimateUniStats(u.country, u.degreeLevel).ielts || "—" },
                { lbl: "Intake *", get: (u: University) => estimateUniStats(u.country, u.degreeLevel).intake || "—" },
                { lbl: "Website", get: (u: University) => (u.website ? "Tersedia" : "—") },
                ...(isAdmin ? [{ lbl: "Agency", get: (u: University) => u.agency || "—" }] : []),
              ].map((row) => (
                <tr key={row.lbl} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px", color: "var(--text-muted)", fontWeight: 600 }}>{row.lbl}</td>
                  {selectedUnis.map((u) => (
                    <td key={u.id} style={{ padding: "10px" }}>{row.get(u)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ── Mentee picker modal ──────────────────────────────────── */}
      <Modal
        open={menteeOpen}
        onClose={() => setMenteeOpen(false)}
        title="Cocokkan untuk mentee"
        description="Pilih mentee — pencarian akan diisi dari target jurusan & negara tujuan mereka."
        size="lg"
        actions={<button type="button" className="db-btn db-btn-outline" onClick={() => setMenteeOpen(false)}>Tutup</button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {mentees.map((m) => (
            <button
              key={m.id}
              type="button"
              className="row-mini clickable"
              style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 10 }}
              onClick={() => matchMentee(m)}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                {m.target && <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{m.target}{m.destinations ? ` · ${m.destinations}` : ""}</span>}
              </span>
              <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>Cocokkan →</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
