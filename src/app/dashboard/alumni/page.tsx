"use client";

/**
 * Direktori Alumni (/dashboard/alumni).
 *
 * Browse SatuTuju alumni (the public mentor showcase) by destination country,
 * see their campus / major / story, and request an intro. Privacy-safe: shows
 * only public showcase fields (no contact details). "Minta perkenalan" routes
 * through the existing feedback → admin pipeline so SatuTuju facilitates the
 * connection rather than exposing the alumnus directly.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { ALUMNI, ALUMNI_COUNTRIES, type Alumni } from "@/data/alumni";

/** Flag via flagcdn — plain <img> on purpose (CDN isn't whitelisted in
 *  next.config; matches the landing HeroSection pattern). */
function Flag({ code, country, size = 18 }: { code?: string; country?: string; size?: number }) {
  if (!code) return null;
  const h = Math.round(size * 0.72);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="alm-flag" src={`https://flagcdn.com/h24/${code}.png`} width={size} height={h} alt={country || ""} />
  );
}

function introMessage(a: Alumni): string {
  const where = [a.university, a.major].filter(Boolean).join(" — ");
  return `[Direktori Alumni] Mau dikenalkan ke ${a.fullName}${where ? ` (${where})` : ""} untuk tanya insight kampus/jurusan.`;
}

export default function AlumniDirectoryPage() {
  const [country, setCountry] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openAlumni, setOpenAlumni] = useState<Alumni | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALUMNI.filter((a) => {
      if (country !== "all" && a.country !== country) return false;
      if (!q) return true;
      return [a.fullName, a.nickname, a.university, a.major, a.scholarship, a.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [country, query]);

  async function requestIntro(a: Alumni) {
    if (requested.has(a.id) || sending) return;
    setSending(a.id);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Lainnya", message: introMessage(a), anonymous: false }),
      });
      if (res.ok) setRequested((prev) => new Set(prev).add(a.id));
    } finally {
      setSending(null);
    }
  }

  function Avatar({ a, size }: { a: Alumni; size: number }) {
    if (a.photo) {
      return (
        <span className="alm-photo" style={{ width: size, height: size }}>
          <Image src={a.photo} alt={a.fullName} fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
        </span>
      );
    }
    return (
      <span className={`alm-photo alm-fallback ${a.color}`} style={{ width: size, height: size, fontSize: size * 0.32 }}>
        {a.initials}
      </span>
    );
  }

  function IntroButton({ a, full }: { a: Alumni; full?: boolean }) {
    const done = requested.has(a.id);
    const busy = sending === a.id;
    return (
      <button
        type="button"
        className={`db-btn ${done ? "db-btn-outline" : "db-btn-primary"} sm`}
        style={full ? { width: "100%", justifyContent: "center" } : undefined}
        onClick={() => requestIntro(a)}
        disabled={done || busy}
      >
        {done ? <><Icon name="check" size={14} /> Permintaan terkirim</> : busy ? "Mengirim…" : <><Icon name="send" size={14} /> Minta perkenalan</>}
      </button>
    );
  }

  return (
    <div className="alm-page">
      <Link className="kc-back" href="/dashboard/resources">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Materi
      </Link>

      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Materi · Direktori</div>
          <h1 className="sesi-title">Direktori <span className="lede">Alumni.</span></h1>
          <p className="sesi-sub">
            {ALUMNI.length} alumni SatuTuju yang sudah sampai ke kampus tujuan. Lihat jejak & cerita mereka, lalu minta dikenalkan lewat tim SatuTuju buat tanya-tanya insight kampus atau jurusan incaranmu.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="alm-controls">
        <div className="filter-chips">
          <button type="button" className={`db-pill ${country === "all" ? "on" : ""}`} onClick={() => setCountry("all")}>
            Semua <span className="alm-n">{ALUMNI.length}</span>
          </button>
          {ALUMNI_COUNTRIES.map((c) => {
            const n = ALUMNI.filter((a) => a.country === c).length;
            return (
              <button type="button" key={c} className={`db-pill ${country === c ? "on" : ""}`} onClick={() => setCountry(c)}>
                {c} <span className="alm-n">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="alm-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder="Cari nama, kampus, atau jurusan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <div className="alm-empty">Tidak ada alumni yang cocok dengan pencarianmu.</div>
      ) : (
        <div className="alm-grid">
          {shown.map((a) => (
            <div key={a.id} className="alm-card">
              <div className="alm-card-top">
                <Avatar a={a} size={56} />
                <div className="alm-id">
                  <h3 className="alm-name">{a.fullName}</h3>
                  <div className="alm-where">
                    <Flag code={a.flagCode} country={a.country} size={18} />
                    <span>{a.country}</span>
                  </div>
                </div>
              </div>
              <div className="alm-uni">{a.university}</div>
              <div className="alm-major">{a.major}</div>
              <span className="alm-sch"><Icon name="graduation" size={12} /> {a.scholarship}</span>
              {a.achievement && <p className="alm-ach">“{a.achievement}”</p>}
              <div className="alm-actions">
                <button type="button" className="db-btn db-btn-outline sm" onClick={() => setOpenAlumni(a)}>Lihat profil</button>
                <IntroButton a={a} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile modal */}
      <Modal
        open={!!openAlumni}
        onClose={() => setOpenAlumni(null)}
        title={openAlumni?.fullName || "Alumni"}
        description={openAlumni ? `${openAlumni.university}${openAlumni.major ? " · " + openAlumni.major : ""}` : ""}
        size="lg"
        actions={openAlumni ? <IntroButton a={openAlumni} full /> : null}
      >
        {openAlumni && (
          <div className="alm-detail">
            <div className="alm-detail-head">
              <Avatar a={openAlumni} size={72} />
              <div>
                <div className="alm-where">
                  <Flag code={openAlumni.flagCode} country={openAlumni.country} size={20} />
                  <span>{openAlumni.country}</span>
                  {openAlumni.hometown && <span className="alm-dot">·</span>}
                  {openAlumni.hometown && <span>asal {openAlumni.hometown}</span>}
                </div>
                <span className="alm-sch" style={{ marginTop: 8 }}><Icon name="graduation" size={12} /> {openAlumni.scholarship}</span>
              </div>
            </div>

            <dl className="alm-facts">
              <div><dt>S2</dt><dd>{openAlumni.university} — {openAlumni.major}</dd></div>
              {openAlumni.s1 && <div><dt>S1</dt><dd>{openAlumni.s1}</dd></div>}
              {openAlumni.achievement && <div><dt>Pencapaian</dt><dd>{openAlumni.achievement}</dd></div>}
            </dl>

            {openAlumni.message && (
              <blockquote className="alm-quote">“{openAlumni.message}”</blockquote>
            )}

            <p className="alm-note">
              <Icon name="lightbulb" size={13} /> Minta perkenalan, dan tim SatuTuju akan menghubungkanmu dengan {openAlumni.nickname}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
