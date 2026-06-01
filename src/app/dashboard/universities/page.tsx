"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import * as AllFlags from "country-flag-icons/react/3x2";

/* ─── Country / flag config ───────────────────────────────────────── */

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

function FlagIcon({ code, className = "" }: { code: string; className?: string }) {
  const Flag = (AllFlags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[code];
  if (!Flag) return null;
  return <Flag className={className} />;
}

/** Region quick-filter pills shown in the "Negara" row. */
const REGION_PILLS: Array<{ key: string; label: string; flag: string }> = [
  { key: "", label: "Semua", flag: "🌐" },
  { key: "au-nz", label: "AU/NZ", flag: "🇦🇺" },
  { key: "uk", label: "UK", flag: "🇬🇧" },
  { key: "us", label: "US", flag: "🇺🇸" },
  { key: "canada", label: "Canada", flag: "🇨🇦" },
  { key: "europe", label: "Eropa", flag: "🇪🇺" },
  { key: "asia", label: "Asia", flag: "🌏" },
  { key: "others", label: "Lainnya", flag: "🌍" },
];

const DEGREE_LABEL: Record<string, string> = {
  Undergraduate: "Undergraduate / Bachelor",
  Graduate: "Postgraduate / Master",
  "English Language": "English Language",
  "English Language / Foundation": "English / Foundation",
  "Summer Programs": "Summer Programs",
  All: "Semua jenjang",
};

interface University {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
  programs?: string;
}

interface PairingMin {
  id: string;
  mentee: { id: string; name: string };
}

const PAGE_SIZE = 20;

type SortKey = "relevance" | "alpha" | "country" | "level";
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "relevance", label: "Relevansi" },
  { key: "alpha", label: "Nama A–Z" },
  { key: "country", label: "Negara" },
  { key: "level", label: "Jenjang" },
];

/* ─── Page ────────────────────────────────────────────────────────── */

export default function UniversitiesPage() {
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [pairings, setPairings] = useState<PairingMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");

  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [compare, setCompare] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUniversities = useCallback((q: string, r: string, l: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (r) params.set("region", r);
    if (l) params.set("level", l);
    fetch(`/api/universities?${params}`)
      .then((res) => res.json())
      .then((d) => {
        setUniversities(d.universities || []);
        setTotal(d.total || 0);
        setVisibleCount(PAGE_SIZE);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUniversities("", "", "");
    // Pull pairings so the wishlist rail can show real mentee names.
    fetch("/api/pairings")
      .then((r) => r.json())
      .then((d) => setPairings(d.pairings || []))
      .catch(() => {});
  }, [fetchUniversities]);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUniversities(value, region, level), 300);
  }
  function handleRegion(r: string) {
    setRegion(r);
    fetchUniversities(search, r, level);
  }
  function handleLevel(l: string) {
    setLevel(l);
    fetchUniversities(search, region, l);
  }

  function toggleBookmark(id: number, e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleCompare(id: number, e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  // Build applied-filter chips from current state.
  const appliedChips = useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = [];
    if (search) chips.push({ label: search, clear: () => handleSearch("") });
    if (region) chips.push({ label: REGION_PILLS.find((r) => r.key === region)?.label || region, clear: () => handleRegion("") });
    if (level) chips.push({ label: DEGREE_LABEL[level] || level, clear: () => handleLevel("") });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, region, level]);

  // Apply client-side sort. Server orders by relevance (default), so we only
  // re-sort when the user picks something else.
  const sortedUnis = useMemo(() => {
    if (sort === "relevance") return universities;
    const arr = [...universities];
    arr.sort((a, b) => {
      if (sort === "alpha") return a.name.localeCompare(b.name);
      if (sort === "country") {
        const c = a.country.localeCompare(b.country);
        return c !== 0 ? c : a.name.localeCompare(b.name);
      }
      if (sort === "level") {
        const c = (a.degreeLevel || "").localeCompare(b.degreeLevel || "");
        return c !== 0 ? c : a.name.localeCompare(b.name);
      }
      return 0;
    });
    return arr;
  }, [universities, sort]);
  const visibleUnis = sortedUnis.slice(0, visibleCount);
  const compareList = useMemo(
    () => Array.from(compare).map((id) => universities.find((u) => u.id === id)).filter(Boolean) as University[],
    [compare, universities],
  );

  // Wishlist mentees: from real pairings, deterministic count derived from id.
  const wishlist = useMemo(() => {
    return pairings.slice(0, 4).map((p) => ({
      name: p.mentee.name,
      pairingId: p.id,
      // No real wishlist field — show "0 kampus" so we don't fake counts.
      count: 0,
    }));
  }, [pairings]);

  /* ─── Render ───────────────────────────────────────────────────── */

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Direktori kampus mitra</div>
          <h1 className="sesi-title">
            Kampus <span className="lede">— {total.toLocaleString("id-ID")} pintu masuk.</span>
          </h1>
          <p className="sesi-sub">
            Cari kampus berdasarkan negara, jenjang, atau langsung cocokkan untuk mentee tertentu.
            Centang sampai 4 kampus untuk dibandingkan.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="kampus-stats">
        <div className="kampus-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          </div>
          <div>
            <div className="lbl">Kampus</div>
            <div className="val">{total.toLocaleString("id-ID")}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
            </svg>
          </div>
          <div>
            <div className="lbl">Negara</div>
            <div className="val">{Object.keys(COUNTRY_CODES).length}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <div className="lbl">Wishlist kamu</div>
            <div className="val">{bookmarks.size}</div>
          </div>
        </div>
        <div className="kampus-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="lbl">Dipilih bandingkan</div>
            <div className="val">{compare.size} / 4</div>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="filter-block">
        <div className="search-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            placeholder="Cari nama kampus, kota, atau jurusan…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </div>

        <div className="filter-row-2">
          <span className="label-inline">Negara</span>
          {REGION_PILLS.map((r) => (
            <button
              type="button"
              key={r.key}
              className={`db-pill ${region === r.key ? "on" : ""}`}
              onClick={() => handleRegion(r.key)}
            >
              <span className="flag-emoji">{r.flag}</span>
              {r.label}
            </button>
          ))}
        </div>

        <div className="filter-row-2">
          <span className="label-inline">Jenjang</span>
          {([
            { key: "", label: "Semua" },
            { key: "Undergraduate", label: "S1 (Bachelor)" },
            { key: "Graduate", label: "S2 (Master)" },
            { key: "English Language", label: "English / Foundation" },
            { key: "Summer Programs", label: "Summer" },
          ] as Array<{ key: string; label: string }>).map((opt) => (
            <button
              type="button"
              key={opt.key}
              className={`db-pill ${level === opt.key ? "on" : ""}`}
              onClick={() => handleLevel(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result bar */}
      <div className="result-bar">
        <div className="count">
          <b>{universities.length.toLocaleString("id-ID")}</b>
          <span className="unit">kampus</span>
        </div>
        <div className="applied">
          {appliedChips.map((c, i) => (
            <button type="button" key={i} className="applied-chip" onClick={c.clear}>
              {c.label}
              <span className="x">✕</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <div className="sort-control">
          <span>Urut</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Split: list + sidebar */}
      <div className="uni-split">
        <div className="uni-list">
          {loading ? (
            <div className="uni-card" style={{ textAlign: "center", padding: 56, color: "var(--text-muted-2)" }}>
              <Icon name="search" size={28} />
              <p style={{ marginTop: 12 }}>Memuat kampus…</p>
            </div>
          ) : visibleUnis.length === 0 ? (
            <div className="uni-card" style={{ textAlign: "center", padding: 56, color: "var(--text-muted-2)" }}>
              <Icon name="search" size={28} />
              <p style={{ marginTop: 12 }}>Tidak ada kampus yang cocok.</p>
              <button
                type="button"
                onClick={() => { setSearch(""); setRegion(""); setLevel(""); fetchUniversities("", "", ""); }}
                className="db-btn db-btn-outline sm"
                style={{ marginTop: 12 }}
              >
                Reset filter
              </button>
            </div>
          ) : (
            visibleUnis.map((u) => {
              const code = COUNTRY_CODES[u.country];
              const isFeatured = compare.has(u.id);
              const isBookmarked = bookmarks.has(u.id);
              const website = u.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";

              return (
                <a
                  key={u.id}
                  href={u.website || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`uni-card${isFeatured ? " featured" : ""}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="uni-top">
                    <div className="uni-flag" title={u.country}>
                      {code ? <FlagIcon code={code} /> : "🌐"}
                    </div>
                    <div className="uni-info">
                      <h3 className="uni-name">{u.name}</h3>
                      <div className="uni-place">
                        {u.country.toUpperCase()}
                        {website && ` · ${website}`}
                      </div>
                    </div>
                    <div className="uni-actions">
                      <button
                        type="button"
                        className={`iconbtn-sm${isFeatured ? " on" : ""}`}
                        title={isFeatured ? "Hapus dari bandingkan" : "Tambah ke bandingkan"}
                        onClick={(e) => toggleCompare(u.id, e)}
                      >
                        {isFeatured ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className={`iconbtn-sm${isBookmarked ? " on" : ""}`}
                        title={isBookmarked ? "Tersimpan" : "Simpan"}
                        onClick={(e) => toggleBookmark(u.id, e)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="iconbtn-sm"
                        title="Kirim ke mentee (segera)"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 2L11 13" />
                          <path d="M22 2l-7 20-4-9-9-4z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="uni-meta">
                    <div className="cell">
                      <div className="lbl">Negara</div>
                      <div className="val">{u.country}</div>
                      <div className="sub">{code || "—"}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">Jenjang</div>
                      <div className="val">{DEGREE_LABEL[u.degreeLevel] || u.degreeLevel}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">Programs</div>
                      <div className="val">{u.programs ? `${u.programs.split(",").length}+ program` : "Lihat website"}</div>
                    </div>
                    <div className="cell">
                      <div className="lbl">Website</div>
                      <div className="val" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {website || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="uni-tags">
                    <span className="db-pill static accent">{DEGREE_LABEL[u.degreeLevel] || u.degreeLevel}</span>
                    {u.programs && u.programs.length > 0 && (
                      <span className="db-pill static">Multi-program</span>
                    )}
                    {isBookmarked && <span className="db-pill static good">★ Tersimpan</span>}
                  </div>
                </a>
              );
            })
          )}

          {visibleUnis.length < universities.length && !loading && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted-3)", fontSize: 13 }}>
              Menampilkan {visibleUnis.length} dari{" "}
              <b style={{ color: "var(--foreground)" }}>{universities.length}</b> hasil ·{" "}
              <button
                type="button"
                onClick={() => setVisibleCount((n) => Math.min(n + PAGE_SIZE, universities.length))}
                style={{
                  color: "var(--primary-700)",
                  fontFamily: "var(--font-poppins)",
                  fontWeight: 600,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                muat {Math.min(PAGE_SIZE, universities.length - visibleUnis.length)} berikutnya ↓
              </button>
            </div>
          )}

          {/* Sticky compare bar — only when there are items selected */}
          {compareList.length > 0 && (
            <div className="compare-bar">
              <div className="count">
                <span className="num">{compareList.length}</span>
                dipilih
              </div>
              <div className="who">
                {compareList.map((u) => u.name.split(" ").slice(0, 2).join(" ")).join(", ")} ·
                <b> bandingkan side-by-side</b>{compareList.length < 4 ? ` atau pilih ${4 - compareList.length} lagi.` : "."}
              </div>
              <button type="button" className="btn btn-ghost-d" onClick={() => setCompare(new Set())}>
                Bersihkan
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  // Stash the selected universities in sessionStorage so the
                  // compare page can hydrate without re-fetching the whole
                  // 3.5k-row directory. Survives the navigation but not a
                  // full browser restart — feels right for an ephemeral
                  // compare action.
                  try {
                    sessionStorage.setItem(
                      "kampus-compare",
                      JSON.stringify(compareList),
                    );
                  } catch {
                    /* sessionStorage unavailable — compare page will show empty state */
                  }
                  router.push("/dashboard/universities/compare");
                }}
              >
                Bandingkan →
              </button>
            </div>
          )}
        </div>

        {/* Side rail */}
        <aside className="kampus-side">
          <div className="matchfit-card">
            <span className="tag">Quick action</span>
            <h3>Cocokkan untuk mentee</h3>
            <p>
              Pilih mentee — sistem akan filter berdasarkan target jurusan, budget, dan IELTS mereka.
              (segera tersedia)
            </p>
            <Link href="/dashboard/mentee" className="db-btn db-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              <Icon name="users" size={16} />
              Pilih mentee →
            </Link>
          </div>

          {wishlist.length > 0 && (
            <div className="kampus-side-card">
              <h3>Wishlist mentee kamu</h3>
              {wishlist.map((m) => (
                <Link
                  key={m.pairingId}
                  href={`/dashboard/pairings/${m.pairingId}`}
                  className="row-mini"
                >
                  <span className="name">{m.name}</span>
                  <span className="val">{m.count} kampus</span>
                </Link>
              ))}
            </div>
          )}

          <div className="kampus-side-card">
            <h3>Tips pakai direktori</h3>
            <div style={{ fontSize: 13, color: "var(--text-muted-3)", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 8px" }}>
                <b style={{ color: "var(--foreground)" }}>1.</b> Filter dulu per negara dan jenjang — biar list manageable.
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <b style={{ color: "var(--foreground)" }}>2.</b> Centang sampai 4 kampus, klik <b>Bandingkan</b> di bilah bawah.
              </p>
              <p style={{ margin: 0 }}>
                <b style={{ color: "var(--foreground)" }}>3.</b> Simpan favorit dengan icon bookmark — muncul di Wishlist.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
// Admin inline edit (degreeLevel override) was dropped in the redesign — admins
// can hit /api/universities PATCH directly or a future admin tool. The data
// shape that page used (Select dropdowns, savingId/savedId state) lives in git
// history if we need to lift it back in.
