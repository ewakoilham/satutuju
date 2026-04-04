"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/lib/hooks";

interface University {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
  // admin only
  commissionNote?: string;
  commissionFee?: string;
  agency?: string;
  programs?: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  Australia: "🇦🇺", Austria: "🇦🇹", Belgium: "🇧🇪", Canada: "🇨🇦",
  Caribbean: "🌴", China: "🇨🇳", Croatia: "🇭🇷", Cyprus: "🇨🇾",
  "Czech Republic": "🇨🇿", Finland: "🇫🇮", France: "🇫🇷", Georgia: "🇬🇪",
  Germany: "🇩🇪", Greece: "🇬🇷", Grenada: "🇬🇩", "Hong Kong": "🇭🇰",
  Hungary: "🇭🇺", India: "🇮🇳", Indonesia: "🇮🇩", Ireland: "🇮🇪",
  Italy: "🇮🇹", Japan: "🇯🇵", Kazakhstan: "🇰🇿", Latvia: "🇱🇻",
  Lithuania: "🇱🇹", Malaysia: "🇲🇾", Malta: "🇲🇹", Mauritius: "🇲🇺",
  Monaco: "🇲🇨", Netherlands: "🇳🇱", "New Zealand": "🇳🇿", Philippines: "🇵🇭",
  Poland: "🇵🇱", Portugal: "🇵🇹", Romania: "🇷🇴", Russia: "🇷🇺",
  Singapore: "🇸🇬", "South Korea": "🇰🇷", Spain: "🇪🇸", "Sri Lanka": "🇱🇰",
  Sweden: "🇸🇪", Switzerland: "🇨🇭", Thailand: "🇹🇭", Turkey: "🇹🇷",
  UAE: "🇦🇪", UK: "🇬🇧", USA: "🇺🇸", Vietnam: "🇻🇳", "West Indies": "🌴",
};

const DEGREE_LABELS: Record<string, { label: string; color: string }> = {
  "Undergraduate": { label: "Undergraduate / Bachelor", color: "bg-green-100 text-green-700" },
  "Graduate": { label: "Postgraduate / Master", color: "bg-blue-100 text-blue-700" },
  "English Language": { label: "English Language", color: "bg-yellow-100 text-yellow-700" },
  "English Language / Foundation": { label: "English Language / Foundation", color: "bg-orange-100 text-orange-700" },
  "Summer Programs": { label: "Summer Programs", color: "bg-pink-100 text-pink-700" },
  "All": { label: "All Programs", color: "bg-purple-100 text-purple-700" },
};

const REGION_TABS = [
  { key: "", label: "All", icon: "🌐" },
  { key: "au-nz", label: "Australia & NZ", icon: "🇦🇺" },
  { key: "uk", label: "UK", icon: "🇬🇧" },
  { key: "us", label: "USA", icon: "🇺🇸" },
  { key: "europe", label: "Europe", icon: "🌍" },
  { key: "asia", label: "Asia", icon: "🌏" },
  { key: "others", label: "Others", icon: "📍" },
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
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUniversities = useCallback(
    (q: string, r: string, l: string) => {
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
          setPage(1);
          setExpandedId(null);
        })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    fetchUniversities("", "", "");
  }, [fetchUniversities]);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUniversities(value, region, level);
    }, 350);
  }

  function handleRegion(r: string) {
    setRegion(r);
    setLevel("");
    fetchUniversities(search, r, "");
  }

  function handleLevel(l: string) {
    setLevel(l);
    fetchUniversities(search, region, l);
  }

  function clearFilters() {
    setSearch("");
    setRegion("");
    setLevel("");
    fetchUniversities("", "", "");
  }

  const paginated = universities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(universities.length / PAGE_SIZE);
  const hasFilters = search || region || level;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Partner Universities</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total.toLocaleString()} partner institutions worldwide
        </p>
      </div>

      {/* Region Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide">
          {REGION_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleRegion(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                region === tab.key
                  ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-light)]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by university name or country…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Degree level filter + result count */}
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={level}
            onChange={(e) => handleLevel(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-white"
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
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-gray-400">
            {loading ? "Searching…" : `${universities.length.toLocaleString()} results`}
          </span>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">Loading universities…</div>
        </div>
      ) : universities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-500 font-medium">No universities found</p>
          <p className="text-gray-400 text-sm mt-1">Try a different search or filter</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-sm text-[var(--primary)] hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((u) => (
            <div
              key={u.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                <span className="text-xl flex-shrink-0 w-8 text-center">
                  {COUNTRY_FLAGS[u.country] || "🌍"}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.country}</p>
                </div>

                <span
                  className={`hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    DEGREE_LABELS[u.degreeLevel]?.color || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                </span>

                {u.website && (
                  <a
                    href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="hidden sm:flex items-center gap-1 text-xs text-[var(--primary)] hover:underline flex-shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Website
                  </a>
                )}

                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    expandedId === u.id ? "rotate-180" : ""
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded */}
              {expandedId === u.id && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">University</p>
                      <p className="text-sm font-medium">{u.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Country</p>
                      <p className="text-sm">{COUNTRY_FLAGS[u.country] || "🌍"} {u.country}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Programs Offered</p>
                      <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                        DEGREE_LABELS[u.degreeLevel]?.color || "bg-gray-100 text-gray-600"
                      }`}>
                        {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Admission Website</p>
                      {u.website ? (
                        <a
                          href={u.website.startsWith("http") ? u.website : `https://${u.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--primary)] hover:underline break-all"
                        >
                          {u.website}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </div>
                  </div>

                  {/* Admin-only commission */}
                  {isAdmin && (u.commissionFee || u.commissionNote || u.agency) && (
                    <div className="mt-2 pt-3 border-t border-gray-200 space-y-3">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Admin View — Commission Details
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
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min(page * PAGE_SIZE, universities.length).toLocaleString()} of{" "}
            {universities.length.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
