"use client";

/**
 * 1000 Essays Project (/dashboard/essays).
 *
 * A curated, filterable directory of scholarship-essay resources that LINK
 * OUT to their original public sources — official program guidance,
 * university writing centers, and essays awardees published themselves.
 * We never host or republish the text (see essay-links.ts for the curation
 * rules). Reachable from the Materi "1000 Essays Project" card.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import {
  ESSAY_LINKS,
  ESSAY_SCHOLARSHIPS,
  SCHOLARSHIP_META,
  KIND_META,
  type EssayKind,
  type EssayScholarship,
} from "@/data/essay-links";

export default function EssaysPage() {
  const [scholarship, setScholarship] = useState<EssayScholarship | "all">("all");
  const [kind, setKind] = useState<EssayKind | "all">("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ESSAY_LINKS.filter((e) => {
      if (scholarship !== "all" && e.scholarship !== scholarship) return false;
      if (kind !== "all" && e.kind !== kind) return false;
      if (!q) return true;
      return [e.title, e.publisher, e.description, SCHOLARSHIP_META[e.scholarship].label]
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [scholarship, kind, query]);

  return (
    <div className="esy-page">
      <Link className="kc-back" href="/dashboard/resources">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Materi
      </Link>

      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Materi · Contoh</div>
          <h1 className="sesi-title">1000 Essays <span className="lede">Project.</span></h1>
          <p className="sesi-sub">
            Kurasi {ESSAY_LINKS.length} esai & panduan beasiswa dari sumber terbuka — panduan resmi Chevening, LPDP, AAS, Fulbright, plus esai yang dipublikasikan sendiri oleh para awardee. Koleksinya terus bertambah.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="esy-controls">
        <div className="filter-chips">
          <button type="button" className={`db-pill ${scholarship === "all" ? "on" : ""}`} onClick={() => setScholarship("all")}>
            Semua <span className="esy-n">{ESSAY_LINKS.length}</span>
          </button>
          {ESSAY_SCHOLARSHIPS.map((s) => {
            const n = ESSAY_LINKS.filter((e) => e.scholarship === s).length;
            return (
              <button type="button" key={s} className={`db-pill ${scholarship === s ? "on" : ""}`} onClick={() => setScholarship(s)}>
                {SCHOLARSHIP_META[s].label} <span className="esy-n">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="filter-chips">
          {(Object.keys(KIND_META) as EssayKind[]).map((k) => (
            <button
              type="button"
              key={k}
              className={`db-pill ${kind === k ? "on" : ""}`}
              onClick={() => setKind(kind === k ? "all" : k)}
            >
              {KIND_META[k].label}
            </button>
          ))}
          <div className="esy-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Cari topik, beasiswa, penulis…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <div className="esy-empty">Tidak ada yang cocok dengan filter/pencarianmu.</div>
      ) : (
        <div className="esy-grid">
          {shown.map((e) => (
            <a key={e.id} className="esy-card" href={e.href} target="_blank" rel="noopener noreferrer">
              <div className="esy-top">
                <span className={`esy-sch sch-${e.scholarship}`}>{SCHOLARSHIP_META[e.scholarship].label}</span>
                <span className="esy-kind">{KIND_META[e.kind].label}</span>
                <span className="esy-lang">{e.lang.toUpperCase()}</span>
              </div>
              <h3 className="esy-title">{e.title}</h3>
              <p className="esy-desc">{e.description}</p>
              <div className="esy-foot">
                <span className="esy-pub">
                  {e.source === "resmi" && <Icon name="check" size={12} />}
                  {e.publisher}
                </span>
                <span className="esy-open">buka <Icon name="external-link" size={12} /></span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Copyright / curation note */}
      <div className="esy-note">
        <Icon name="lightbulb" size={16} />
        <p>
          Semua tautan menuju sumber yang dipublikasikan terbuka oleh penulis atau lembaganya —
          hak cipta tetap milik mereka, SatuTuju tidak menyalin isi esai. Contoh dipakai untuk
          <b> belajar struktur & sudut pandang, bukan ditiru</b> — komite seleksi (dan software
          plagiarisme) mengenali esai template. Ada tautan mati atau usulan sumber baru? Kirim lewat
          tombol <b>Masukan</b>.
        </p>
      </div>
    </div>
  );
}
