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
  commissionRate?: string;
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
  All: { label: "All Programs", color: "bg-purple-100 text-purple-700" },
  Graduate: { label: "Postgraduate / Master", color: "bg-blue-100 text-blue-700" },
  Undergraduate: { label: "Undergraduate / Bachelor", color: "bg-green-100 text-green-700" },
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
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUniversities = useCallback(
    (q: string, c: string, l: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (c) params.set("country", c);
      if (l) params.set("level", l);

      fetch(`/api/universities?${params}`)
        .then((r) => r.json())
        .then((d) => {
          setUniversities(d.universities || []);
          setTotal(d.total || 0);
          setPage(1);
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
      fetchUniversities(value, country, level);
    }, 350);
  }

  function handleCountry(value: string) {
    setCountry(value);
    fetchUniversities(search, value, level);
  }

  function handleLevel(value: string) {
    setLevel(value);
    fetchUniversities(search, country, value);
  }

  function clearFilters() {
    setSearch("");
    setCountry("");
    setLevel("");
    fetchUniversities("", "", "");
  }

  const paginated = universities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(universities.length / PAGE_SIZE);
  const hasFilters = search || country || level;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Partner Universities</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total.toLocaleString()} partner institutions across{" "}
          {ALL_COUNTRIES.length} countries
        </p>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {/* Search bar */}
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
            placeholder="Search university name or country…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
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

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Country filter */}
          <select
            value={country}
            onChange={(e) => handleCountry(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-white"
          >
            <option value="">All Countries</option>
            {ALL_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_FLAGS[c] || "🌍"} {c}
              </option>
            ))}
          </select>

          {/* Degree level filter */}
          <select
            value={level}
            onChange={(e) => handleLevel(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 bg-white"
          >
            <option value="">All Levels</option>
            <option value="Undergraduate">Undergraduate / Bachelor</option>
            <option value="Graduate">Postgraduate / Master</option>
            <option value="All">All Programs (Foundation, Language, etc.)</option>
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
              {/* Main row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                {/* Country flag */}
                <span className="text-xl flex-shrink-0 w-8 text-center">
                  {COUNTRY_FLAGS[u.country] || "🌍"}
                </span>

                {/* Name + country */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.country}</p>
                </div>

                {/* Degree badge */}
                <span
                  className={`hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    DEGREE_LABELS[u.degreeLevel]?.color || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                </span>

                {/* Website link */}
                {u.website && (
                  <a
                    href={
                      u.website.startsWith("http")
                        ? u.website
                        : `https://${u.website}`
                    }
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

                {/* Expand chevron */}
                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    expandedId === u.id ? "rotate-180" : ""
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded detail */}
              {expandedId === u.id && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        University
                      </p>
                      <p className="text-sm font-medium">{u.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Country
                      </p>
                      <p className="text-sm">
                        {COUNTRY_FLAGS[u.country] || "🌍"} {u.country}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Programs Offered
                      </p>
                      <span
                        className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                          DEGREE_LABELS[u.degreeLevel]?.color || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {DEGREE_LABELS[u.degreeLevel]?.label || u.degreeLevel}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Admission Website
                      </p>
                      {u.website ? (
                        <a
                          href={
                            u.website.startsWith("http")
                              ? u.website
                              : `https://${u.website}`
                          }
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

                  {/* Admin-only: commission info */}
                  {isAdmin && (u.commissionRate || u.agency) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Admin Only — Commission Details
                      </p>
                      {u.agency && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Agency</p>
                          <p className="text-sm font-medium">{u.agency}</p>
                        </div>
                      )}
                      {u.commissionRate && (
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Commission Rate</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {u.commissionRate}
                          </p>
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
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
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
