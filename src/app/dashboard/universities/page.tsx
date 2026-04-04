"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { SkeletonTable } from "@/components/ui/Skeleton";

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

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: "\u{1F1E6}\u{1F1FA}", Austria: "\u{1F1E6}\u{1F1F9}", Belgium: "\u{1F1E7}\u{1F1EA}", Canada: "\u{1F1E8}\u{1F1E6}",
  Caribbean: "\u{1F334}", China: "\u{1F1E8}\u{1F1F3}", Croatia: "\u{1F1ED}\u{1F1F7}", Cyprus: "\u{1F1E8}\u{1F1FE}",
  "Czech Republic": "\u{1F1E8}\u{1F1FF}", Finland: "\u{1F1EB}\u{1F1EE}", France: "\u{1F1EB}\u{1F1F7}", Georgia: "\u{1F1EC}\u{1F1EA}",
  Germany: "\u{1F1E9}\u{1F1EA}", Greece: "\u{1F1EC}\u{1F1F7}", Grenada: "\u{1F1EC}\u{1F1E9}", "Hong Kong": "\u{1F1ED}\u{1F1F0}",
  Hungary: "\u{1F1ED}\u{1F1FA}", India: "\u{1F1EE}\u{1F1F3}", Indonesia: "\u{1F1EE}\u{1F1E9}", Ireland: "\u{1F1EE}\u{1F1EA}",
  Italy: "\u{1F1EE}\u{1F1F9}", Japan: "\u{1F1EF}\u{1F1F5}", Kazakhstan: "\u{1F1F0}\u{1F1FF}", Latvia: "\u{1F1F1}\u{1F1FB}",
  Lithuania: "\u{1F1F1}\u{1F1F9}", Malaysia: "\u{1F1F2}\u{1F1FE}", Malta: "\u{1F1F2}\u{1F1F9}", Mauritius: "\u{1F1F2}\u{1F1FA}",
  Monaco: "\u{1F1F2}\u{1F1E8}", Netherlands: "\u{1F1F3}\u{1F1F1}", "New Zealand": "\u{1F1F3}\u{1F1FF}", Philippines: "\u{1F1F5}\u{1F1ED}",
  Poland: "\u{1F1F5}\u{1F1F1}", Portugal: "\u{1F1F5}\u{1F1F9}", Romania: "\u{1F1F7}\u{1F1F4}", Russia: "\u{1F1F7}\u{1F1FA}",
  Singapore: "\u{1F1F8}\u{1F1EC}", "South Korea": "\u{1F1F0}\u{1F1F7}", Spain: "\u{1F1EA}\u{1F1F8}", "Sri Lanka": "\u{1F1F1}\u{1F1F0}",
  Sweden: "\u{1F1F8}\u{1F1EA}", Switzerland: "\u{1F1E8}\u{1F1ED}", Thailand: "\u{1F1F9}\u{1F1ED}", Turkey: "\u{1F1F9}\u{1F1F7}",
  UAE: "\u{1F1E6}\u{1F1EA}", UK: "\u{1F1EC}\u{1F1E7}", USA: "\u{1F1FA}\u{1F1F8}", Vietnam: "\u{1F1FB}\u{1F1F3}", "West Indies": "\u{1F334}",
};

const DEGREE_OPTIONS = [
  "Undergraduate",
  "Graduate",
  "English Language",
  "English Language / Foundation",
  "Summer Programs",
  "All",
];

const DEGREE_BADGE_VARIANT: Record<string, "success" | "info" | "warning" | "danger" | "primary" | "brand" | "neutral"> = {
  Undergraduate: "success",
  Graduate: "info",
  "English Language": "warning",
  "English Language / Foundation": "warning",
  "Summer Programs": "brand",
  All: "primary",
};

const DEGREE_LABELS: Record<string, { label: string; color: string }> = {
  Undergraduate: { label: "Undergraduate / Bachelor", color: "bg-green-100 text-green-700" },
  Graduate: { label: "Postgraduate / Master", color: "bg-blue-100 text-blue-700" },
  "English Language": { label: "English Language", color: "bg-yellow-100 text-yellow-700" },
  "English Language / Foundation": { label: "English Language / Foundation", color: "bg-orange-100 text-orange-700" },
  "Summer Programs": { label: "Summer Programs", color: "bg-pink-100 text-pink-700" },
  All: { label: "All Programs", color: "bg-purple-100 text-purple-700" },
};

const REGION_TABS = [
  { key: "", label: "All", icon: "\u{1F310}" },
  { key: "au-nz", label: "Australia & NZ", icon: "\u{1F1E6}\u{1F1FA}" },
  { key: "uk", label: "UK", icon: "\u{1F1EC}\u{1F1E7}" },
  { key: "us", label: "USA", icon: "\u{1F1FA}\u{1F1F8}" },
  { key: "canada", label: "Canada", icon: "\u{1F1E8}\u{1F1E6}" },
  { key: "europe", label: "Europe", icon: "\u{1F30D}" },
  { key: "asia", label: "Asia", icon: "\u{1F30F}" },
  { key: "others", label: "Others", icon: "\u{1F4CD}" },
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

const PAGE_SIZE = 30;

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
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUniversities(value, region, country, level), 350);
  }

  function handleRegion(r: string) {
    setRegion(r);
    setCountry("");
    setLevel("");
    fetchUniversities(search, r, "", "");
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

  const paginated = universities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(universities.length / PAGE_SIZE);
  const hasFilters = search || region || country || level;

  // Generate page numbers for pill pagination
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Partner Universities</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total.toLocaleString()} partner institutions worldwide
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by university name or country..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="input-field pl-9 pr-9"
        />
        {search && (
          <button onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {/* Region Tabs — segmented control */}
      <div className="bg-gray-100 rounded-xl p-1 overflow-hidden">
        <div className="flex overflow-x-auto gap-0.5" style={{ scrollbarWidth: "none" }}>
          {REGION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleRegion(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition flex-shrink-0 ${
                region === tab.key
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Country filter */}
        <select
          value={country}
          onChange={(e) => handleCountry(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Countries</option>
          {visibleCountries.map((c) => (
            <option key={c} value={c}>
              {COUNTRY_FLAGS[c] || "\u{1F30D}"} {c}
            </option>
          ))}
        </select>

        {/* Degree level filter */}
        <select
          value={level}
          onChange={(e) => handleLevel(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All Levels</option>
          <option value="Undergraduate">Undergraduate / Bachelor</option>
          <option value="Graduate">Postgraduate / Master</option>
          <option value="English Language">English Language</option>
          <option value="English Language / Foundation">English Language / Foundation</option>
          <option value="Summer Programs">Summer Programs</option>
          <option value="All">All Programs</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters}
            className="btn-ghost text-sm px-3 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50">
            <Icon name="x" size={14} className="inline mr-1" />
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {loading ? "Searching..." : `${universities.length.toLocaleString()} results`}
        </span>
      </div>

      {/* Results */}
      {loading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : universities.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <Icon name="search" size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No universities found</p>
          <button onClick={clearFilters} className="mt-4 text-sm text-[var(--primary)] hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((u) => {
            const pendingLevel = editingLevel[u.id] ?? u.degreeLevel;
            const isDirty = editingLevel[u.id] && editingLevel[u.id] !== u.degreeLevel;

            return (
              <div key={u.id} className="card-hover overflow-hidden p-0">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition"
                  onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                >
                  <span className="text-xl flex-shrink-0 w-8 text-center">
                    {COUNTRY_FLAGS[u.country] || "\u{1F30D}"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.country}</p>
                  </div>
                  <span className="hidden sm:inline-flex flex-shrink-0">
                    <Badge variant={DEGREE_BADGE_VARIANT[u.degreeLevel] || "neutral"}>
                      {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                    </Badge>
                  </span>
                  {u.website && (
                    <a
                      href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hidden sm:flex items-center gap-1 text-xs text-[var(--primary)] hover:underline flex-shrink-0"
                    >
                      <Icon name="external-link" size={12} />
                      Website
                    </a>
                  )}
                  <Icon
                    name="chevron-down"
                    size={16}
                    className={`text-gray-400 flex-shrink-0 transition-transform ${expandedId === u.id ? "rotate-180" : ""}`}
                  />
                </div>

                {/* Expanded */}
                {expandedId === u.id && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">University</p>
                        <p className="text-sm font-medium">{u.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Country</p>
                        <p className="text-sm">{COUNTRY_FLAGS[u.country] || "\u{1F30D}"} {u.country}</p>
                      </div>

                      {/* Programs Offered -- admin can edit */}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Programs Offered
                          {isAdmin && <span className="ml-1 text-amber-500 normal-case">(editable)</span>}
                        </p>
                        {isAdmin ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={pendingLevel}
                              onChange={(e) =>
                                setEditingLevel((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="input-field w-auto text-sm"
                            >
                              {DEGREE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{DEGREE_LABELS[opt]?.label || opt}</option>
                              ))}
                            </select>
                            {isDirty && (
                              <button
                                onClick={(e) => { e.stopPropagation(); saveLevel(u); }}
                                disabled={savingId === u.id}
                                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                              >
                                {savingId === u.id ? "Saving..." : "Save"}
                              </button>
                            )}
                            {savedId === u.id && (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <Icon name="check" size={12} /> Saved
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant={DEGREE_BADGE_VARIANT[u.degreeLevel] || "neutral"}>
                            {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Admission Website</p>
                        {u.website ? (
                          <a
                            href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-sm text-[var(--primary)] hover:underline break-all"
                          >
                            {u.website}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">&mdash;</span>
                        )}
                      </div>
                    </div>

                    {/* Admin-only commission */}
                    {isAdmin && (u.commissionFee || u.commissionNote || u.agency) && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Admin View &mdash; Commission Details
                        </p>
                        {u.agency && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Agency</p>
                            <p className="text-sm font-medium">{u.agency}</p>
                          </div>
                        )}
                        {u.commissionFee && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Commission Fee</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{u.commissionFee}</p>
                          </div>
                        )}
                        {u.commissionNote && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Commission Note</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{u.commissionNote}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination — pill-shaped */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}&ndash;
            {Math.min(page * PAGE_SIZE, universities.length).toLocaleString()} of{" "}
            {universities.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="px-3 py-1.5 text-sm rounded-full disabled:opacity-40 hover:bg-gray-100 transition"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => { setPage(p as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className={`min-w-[2rem] px-2 py-1.5 text-sm rounded-full transition font-medium ${
                    page === p
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="px-3 py-1.5 text-sm rounded-full disabled:opacity-40 hover:bg-gray-100 transition"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
