"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { useUser } from "@/lib/hooks";
import { MATERIALS, PHASE_CHIPS, TYPE_CHIPS, type Material, type MaterialPhase, type MaterialType } from "@/data/materials";
import { CURRICULUM, PHASES } from "@/lib/curriculum";

const PHASE_LABEL: Record<string, string> = {
  discovery: "Discovery",
  planning: "Planning",
  writing: "Writing",
  execution: "Execution",
  closing: "Closing",
  all: "Semua",
};

/** Recent reads — placeholder until we track per-user reading history.
 *  Hardcoded so the section visually matches the design. */
const RECENT_READS: Array<{ name: string; sub: string; phaseLabel: string; when: string; href: string }> = [
  {
    name: "Cara mulai sesi pertama",
    sub: "Mentor Toolkit · 5 menit baca",
    phaseLabel: "Discovery",
    when: "2 jam lalu",
    href: "/dashboard/mentor-toolkit",
  },
  {
    name: "Kerangka 10 sesi mentoring",
    sub: "Curriculum Guide · 12 menit baca",
    phaseLabel: "Semua fase",
    when: "kemarin",
    href: "/dashboard/curriculum",
  },
  {
    name: "Swim lane mentee registration",
    sub: "Mentee Journey · 5 fase",
    phaseLabel: "Discovery",
    when: "3 hari lalu",
    href: "/dashboard/mentee-journey",
  },
];

export default function ResourcesPage() {
  const { user } = useUser();
  const role = user?.role ?? "mentee";

  const [phase, setPhase] = useState<MaterialPhase | "all">("all");
  const [types, setTypes] = useState<Set<MaterialType>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [tocOpen, setTocOpen] = useState(false);

  const visible = useMemo(() => {
    return MATERIALS.filter((m) => {
      if (m.roles && !m.roles.includes(role as "mentor" | "mentee" | "admin")) return false;
      if (phase !== "all" && m.phase !== "all" && m.phase !== phase) return false;
      if (types.size > 0 && !types.has(m.type)) return false;
      if (bookmarkedOnly && !m.bookmarked) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [role, phase, types, bookmarkedOnly, search]);

  const liveCount = visible.filter((m) => !m.locked).length;
  const lockedCount = visible.filter((m) => m.locked).length;

  // Featured "Lanjutkan baca" — picks the first non-locked, role-visible material
  // with progress > 0, or falls back to Curriculum Guide.
  const featured: Material | undefined =
    MATERIALS.find((m) => !m.locked && m.progress && m.progress > 0 && (m.roles === null || m.roles.includes(role as "mentor" | "mentee" | "admin"))) ||
    MATERIALS.find((m) => m.id === "curriculum");

  function toggleType(t: MaterialType) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Pustaka mentor</div>
          <h1 className="sesi-title">
            Materi <span className="lede">untuk dipakai.</span>
          </h1>
          <p className="sesi-sub">
            Panduan, template, dan contoh yang sudah dipakai mentor lain. Lanjutkan dari halaman terakhir kamu, atau cari per fase mentee.
          </p>
        </div>
      </div>

      {/* ── Hero shelf — featured / continue reading ─────────────── */}
      {featured && (
        <section className="hero-shelf">
          <div className="hero-cover">
            <div className="num">Mulai · {PHASE_LABEL[featured.phase] ?? "Umum"}</div>
            <div>{featured.title}</div>
            <div className="corner-fold" />
          </div>
          <div className="hero-meta">
            <span className="db-pill">Lanjutkan baca</span>
            <h2>{featured.title}.</h2>
            <p>{featured.description}</p>
            <div className="hero-progress">
              <div className="track">
                <div className="fill" style={{ width: `${featured.progress ?? 0}%` }} />
              </div>
              <div className="lbl">
                <span>{featured.progressLabel ?? `${featured.progress ?? 0}%`}</span>
                <span>{featured.progress && featured.progress > 0 ? "lanjutkan" : "mulai dari awal"}</span>
              </div>
            </div>
            <div className="actions">
              {featured.href ? (
                <Link href={featured.href} className="db-btn db-btn-primary">
                  <svg className="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  {featured.progress && featured.progress > 0 ? `Lanjut dari ${featured.progressLabel?.split(" / ")[0] || ""}` : "Mulai baca"}
                </Link>
              ) : (
                <button type="button" className="db-btn db-btn-primary" disabled>Belum tersedia</button>
              )}
              <button type="button" className="db-btn db-btn-outline" onClick={() => setTocOpen(true)}>
                Daftar isi
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Filter row ─────────────────────────────────────────── */}
      <div className="materi-filter-row">
        <div className="materi-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            placeholder="Cari materi — coba 'motivation letter' atau 'sesi pertama'…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="kbd">⌘K</span>
        </div>
      </div>

      <div className="filter-chips">
        {PHASE_CHIPS.map((p) => (
          <button
            type="button"
            key={p.key}
            className={`db-pill ${phase === p.key ? "on" : ""}`}
            onClick={() => setPhase(p.key)}
          >
            {p.label}
          </button>
        ))}
        <span className="divider" />
        {TYPE_CHIPS.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`db-pill ${types.has(t.key) ? "on" : ""}`}
            onClick={() => toggleType(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          className={`db-pill ${bookmarkedOnly ? "on" : ""}`}
          onClick={() => setBookmarkedOnly((x) => !x)}
        >
          ★ Tersimpan
        </button>
      </div>

      {/* ── Materi grid ────────────────────────────────────────── */}
      <section className="section" style={{ marginTop: 24 }}>
        <div className="section-head">
          <h2>Pustaka inti</h2>
          <span className="meta">
            {liveCount} koleksi
            {lockedCount > 0 && ` · ${lockedCount} segera hadir`}
          </span>
        </div>
        <div className="materi-grid">
          {visible.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: 32, textAlign: "center", color: "var(--text-muted-2)" }}>
              Tidak ada materi yang cocok dengan filter ini. Coba lebar dulu pilihannya.
            </div>
          ) : (
            visible.map((m) => {
              const inner = (
                <>
                  {m.locked && <span className="badge-soon">Segera</span>}
                  <div className="top">
                    <div className="icon">
                      <Icon name={m.icon} size={18} />
                    </div>
                    {!m.locked && (
                      <button
                        type="button"
                        className={`bookmark ${m.bookmarked ? "on" : ""}`}
                        title={m.bookmarked ? "Tersimpan" : "Simpan"}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <Icon name="star" size={16} />
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="label">{m.label}</div>
                    <h3>{m.title}</h3>
                  </div>
                  <div className="desc">{m.description}</div>
                  {!m.locked && (
                    <div className="footer">
                      {m.progress !== undefined ? (
                        <>
                          <span className="pct">{m.progress}%</span>
                          <div className="progress-bar">
                            <div className="fill" style={{ width: `${m.progress}%` }} />
                          </div>
                          {m.progressLabel && <span>{m.progressLabel}</span>}
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1 }}>{PHASE_LABEL[m.phase] ?? "Umum"}</span>
                          <span>baru</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              );

              return m.href && !m.locked ? (
                <Link key={m.id} href={m.href} className={`materi-card tone-${m.tone}`}>
                  {inner}
                </Link>
              ) : (
                <div key={m.id} className={`materi-card tone-${m.tone}${m.locked ? " locked" : ""}`}>
                  {inner}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── Recent + recommendation ────────────────────────────── */}
      <div className="materi-two-col">
        <div>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h2>Terakhir kamu buka</h2>
            <span className="meta">riwayat lokal</span>
          </div>
          <div className="recent-list">
            {RECENT_READS.map((r, i) => (
              <Link key={i} href={r.href} className="recent-row">
                <div className="ico">
                  <Icon name="document" size={16} />
                </div>
                <div>
                  <div className="name">{r.name}</div>
                  <div className="sub">{r.sub}</div>
                </div>
                <span className="db-pill static accent">{r.phaseLabel}</span>
                <span className="when">{r.when}</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h2>Untuk kamu</h2>
          </div>
          <div className="materi-recommend">
            <span className="tag">Direkomendasikan</span>
            <h3>Mulai dari Curriculum Guide</h3>
            <p>Kerangka penuh 10-sesi adalah peta jalan kamu sebagai mentor. Buka sebelum sesi pertama dengan mentee baru.</p>
            <div className="ctx">
              <b>Kenapa ini muncul:</b> kamu mentor baru atau punya mentee yang belum mulai sesi 1. Materi ini paling sering jadi rujukan.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/dashboard/curriculum" className="db-btn db-btn-primary">Buka panduan</Link>
              <button type="button" className="db-btn-ghost">Tunda</button>
            </div>
          </div>

          <div className="cmd-hint">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>buka pencarian materi dari mana saja — tanpa pindah halaman. (segera)</span>
          </div>
        </div>
      </div>

      {/* ── Curriculum table-of-contents modal ─────────────────────
          Triggered by "Daftar isi" on the hero. Mirrors the structure on
          /dashboard/curriculum but lets the mentor scan + jump without
          leaving Materi. */}
      <Modal
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        title="Curriculum Guide · Daftar isi"
        description="10 sesi terstruktur dalam 5 fase. Klik sesi untuk loncat ke halaman kurikulum."
        size="xl"
        actions={
          <>
            <button type="button" className="db-btn db-btn-outline" onClick={() => setTocOpen(false)}>Tutup</button>
            <Link href="/dashboard/curriculum" className="db-btn db-btn-primary" onClick={() => setTocOpen(false)}>
              Buka halaman penuh →
            </Link>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {CURRICULUM.map((s) => {
            const p = PHASES[s.phase as keyof typeof PHASES];
            return (
              <Link
                key={s.sessionNum}
                href={`/dashboard/curriculum#session-${s.sessionNum}`}
                onClick={() => setTocOpen(false)}
                className="journey-row"
                style={{ textDecoration: "none", color: "inherit", borderTop: "1px solid #ecf1f5" }}
              >
                <span className="num">{s.sessionNum}</span>
                <span className="name">
                  Sesi {s.sessionNum} — {s.topic}
                  <span style={{
                    display: "block",
                    fontFamily: "var(--font-geist-sans)",
                    fontWeight: 400,
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}>
                    {p ? `${p.emoji} ${p.label}` : s.phase} · {s.duration} mnt · {s.objective.slice(0, 80)}{s.objective.length > 80 ? "…" : ""}
                  </span>
                </span>
                <span className="when">{s.deliverables.length} output</span>
              </Link>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
