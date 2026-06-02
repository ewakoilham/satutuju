"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PublicUniversity {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
}

const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Semua jenjang" },
  { value: "Undergraduate", label: "Sarjana (S1)" },
  { value: "Graduate", label: "Pascasarjana (S2/S3)" },
  { value: "English Language", label: "Kelas Bahasa Inggris" },
  { value: "English Language / Foundation", label: "Foundation" },
  { value: "Summer Programs", label: "Summer Program" },
];

const LEVEL_LABELS: Record<string, string> = {
  All: "Semua program",
  Undergraduate: "Sarjana",
  Graduate: "Pascasarjana",
  "English Language": "Kelas Bahasa",
  "English Language / Foundation": "Foundation",
  "Summer Programs": "Summer",
};

const PAGE_SIZE = 60;

function websiteHref(site: string): string {
  if (!site) return "";
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export default function UniversityDirectory({ countries }: { countries: string[] }) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [level, setLevel] = useState("");

  const [universities, setUniversities] = useState<PublicUniversity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Guards against out-of-order responses when filters change rapidly.
  const seqRef = useRef(0);

  const fetchPage = useCallback(
    async (offset: number) => {
      const seq = ++seqRef.current;
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (country) params.set("country", country);
      if (level) params.set("level", level);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      try {
        const res = await fetch(`/api/public/universities?${params}`);
        const data = await res.json();
        if (seq !== seqRef.current) return; // a newer request superseded this one
        setTotal(data.total ?? 0);
        setUniversities((prev) =>
          offset === 0 ? data.universities ?? [] : [...prev, ...(data.universities ?? [])],
        );
      } catch {
        if (seq !== seqRef.current) return;
        if (offset === 0) {
          setUniversities([]);
          setTotal(0);
        }
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [q, country, level],
  );

  // Debounced reload whenever a filter changes.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => fetchPage(0), 250);
    return () => clearTimeout(t);
  }, [fetchPage]);

  const canLoadMore = universities.length < total;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mb-6">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama universitas atau negara…"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-text-muted-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Cari universitas"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Filter negara"
        >
          <option value="">Semua negara</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Filter jenjang"
        >
          {LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Result count ────────────────────────────────────────── */}
      <p className="text-sm text-text-muted mb-4" aria-live="polite">
        {loading
          ? "Memuat…"
          : total === 0
            ? "Tidak ada universitas yang cocok dengan pencarianmu."
            : `Menampilkan ${universities.length} dari ${total.toLocaleString("id-ID")} universitas`}
      </p>

      {/* ── Results grid ────────────────────────────────────────── */}
      {!loading && universities.length > 0 && (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {universities.map((u) => {
            const href = websiteHref(u.website);
            return (
              <li
                key={u.id}
                className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-2 hover:shadow-[var(--shadow-sm)] transition"
              >
                <h3 className="font-semibold text-foreground leading-snug text-[0.95rem]">
                  {u.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-brand-blue-soft text-primary text-xs font-medium px-2 py-0.5">
                    {u.country}
                  </span>
                  {u.degreeLevel && u.degreeLevel !== "All" && (
                    <span className="inline-flex items-center rounded-full bg-surface-elevated text-text-muted text-xs px-2 py-0.5">
                      {LEVEL_LABELS[u.degreeLevel] ?? u.degreeLevel}
                    </span>
                  )}
                </div>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-auto text-sm text-primary font-medium hover:text-primary-700 hover:underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    Kunjungi situs
                    <span aria-hidden>↗</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Load more ───────────────────────────────────────────── */}
      {!loading && canLoadMore && (
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={() => {
              setLoadingMore(true);
              fetchPage(universities.length);
            }}
            disabled={loadingMore}
            className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-elevated transition disabled:opacity-50"
          >
            {loadingMore ? "Memuat…" : "Muat lebih banyak"}
          </button>
        </div>
      )}
    </div>
  );
}
