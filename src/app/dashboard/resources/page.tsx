"use client";

import { useEffect, useMemo, useState } from "react";
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

/* ─── Lightweight pairing/session shapes (only what we read) ──────── */
interface RecSession {
  id: string;
  sessionNum: number;
  phase: string;
  topic?: string | null;
  status: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  mentorSubmittedAt?: string | null;
}
interface RecPairing {
  id: string;
  status?: string;
  mentee: { id: string; name: string };
  mentor?: { id: string; name: string } | null;
  sessions: RecSession[];
}

/* ─── Time helpers ───────────────────────────────────────────────── */
function parseTs(value?: string | null): number | null {
  if (!value) return null;
  const s = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(s.endsWith("Z") ? s : s + "Z");
  return isNaN(d.getTime()) ? null : d.getTime();
}
function fmtAgo(ms: number, nowMs: number): string {
  const s = Math.floor((nowMs - ms) / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return d === 1 ? "kemarin" : `${d} hari lalu`;
}
function fmtWhen(ms: number, nowMs: number): string {
  const days = Math.round((ms - nowMs) / 86_400_000);
  if (days < 0) return "sudah lewat";
  if (days === 0) return "hari ini";
  if (days === 1) return "besok";
  if (days < 7) return `${days} hari lagi`;
  return new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || name;
}

const BOOKMARK_KEY = "materi-bookmarks";
const RECENT_KEY = "materi-recent";

export default function ResourcesPage() {
  const { user } = useUser();
  const role = user?.role ?? "mentee";

  const [phase, setPhase] = useState<MaterialPhase | "all">("all");
  const [types, setTypes] = useState<Set<MaterialType>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [tocOpen, setTocOpen] = useState(false);

  // Bookmarks + recent reads persist in localStorage (no backing table yet).
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<Array<{ id: string; at: number }>>([]);
  // Pairings drive the "Untuk kamu" recommendation (mentor's nearest session).
  const [pairings, setPairings] = useState<RecPairing[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    try {
      const rawB = localStorage.getItem(BOOKMARK_KEY);
      setBookmarks(rawB ? new Set(JSON.parse(rawB)) : new Set(MATERIALS.filter((m) => m.bookmarked).map((m) => m.id)));
    } catch {
      setBookmarks(new Set(MATERIALS.filter((m) => m.bookmarked).map((m) => m.id)));
    }
    try {
      const rawR = localStorage.getItem(RECENT_KEY);
      if (rawR) setRecent(JSON.parse(rawR));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pairings")
      .then((r) => (r.ok ? r.json() : { pairings: [] }))
      .then((d) => {
        if (!cancelled) setPairings((d.pairings as RecPairing[]) || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleBookmark(id: string) {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function recordOpen(id: string) {
    setRecent((prev) => {
      const next = [{ id, at: Date.now() }, ...prev.filter((r) => r.id !== id)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const visible = useMemo(() => {
    return MATERIALS.filter((m) => {
      if (m.roles && !m.roles.includes(role as "mentor" | "mentee" | "admin")) return false;
      if (phase !== "all" && m.phase !== "all" && m.phase !== phase) return false;
      if (types.size > 0 && !types.has(m.type)) return false;
      if (bookmarkedOnly && !bookmarks.has(m.id)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !m.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [role, phase, types, bookmarkedOnly, bookmarks, search]);

  const liveCount = visible.filter((m) => !m.locked).length;
  const lockedCount = visible.filter((m) => m.locked).length;

  // Featured "Lanjutkan baca" — a material the user bookmarked, else Curriculum Guide.
  const featured: Material | undefined =
    MATERIALS.find((m) => !m.locked && bookmarks.has(m.id) && (m.roles === null || m.roles.includes(role as "mentor" | "mentee" | "admin"))) ||
    MATERIALS.find((m) => m.id === "curriculum");

  // Recently opened — real history from localStorage, mapped back to materials.
  const recentRows = useMemo(
    () =>
      recent
        .map((r) => ({ at: r.at, m: MATERIALS.find((x) => x.id === r.id) }))
        .filter((x): x is { at: number; m: Material } => !!x.m && !!x.m.href),
    [recent],
  );

  // "Untuk kamu" — mentor's nearest upcoming/active session across mentees.
  const rec = useMemo(() => {
    if (role !== "mentor") return null;
    let best: { menteeName: string; session: RecSession; ms: number } | null = null;
    for (const p of pairings) {
      const sessions = [...(p.sessions || [])].sort((a, b) => a.sessionNum - b.sessionNum);
      const next = sessions.find((s) => s.status !== "completed" && !s.mentorSubmittedAt);
      if (!next) continue;
      const ms = parseTs(next.scheduledAt) ?? Number.POSITIVE_INFINITY;
      if (!best || ms < best.ms) best = { menteeName: p.mentee?.name || "Mentee", session: next, ms };
    }
    return best;
  }, [role, pairings]);

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
          <div className="sesi-crumb">{role === "mentee" ? "Materi" : "Pustaka mentor"}</div>
          <h1 className="sesi-title">
            Materi <span className="lede">{role === "mentee" ? "buat belajar mandiri." : "untuk dipakai."}</span>
          </h1>
          <p className="sesi-sub">
            {role === "mentee"
              ? "Panduan, template, dan contoh untuk belajar mandiri. Cari, simpan, dan buka kapan pun kamu butuh."
              : "Panduan, template, dan contoh yang sudah dipakai mentor lain. Lanjutkan dari halaman terakhir kamu, atau cari per fase mentee."}
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
                <Link href={featured.href} className="db-btn db-btn-primary" onClick={() => recordOpen(featured.id)}>
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
              const isBookmarked = bookmarks.has(m.id);
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
                        className={`bookmark ${isBookmarked ? "on" : ""}`}
                        title={isBookmarked ? "Hapus dari tersimpan" : "Simpan"}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(m.id); }}
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
                      {m.progress !== undefined && m.progress > 0 ? (
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
                          <span>{isBookmarked ? "★ tersimpan" : "buka"}</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              );

              return m.href && !m.locked ? (
                <Link key={m.id} href={m.href} className={`materi-card tone-${m.tone}`} onClick={() => recordOpen(m.id)}>
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
            {recentRows.length === 0 ? (
              <div className="recent-row" style={{ cursor: "default" }}>
                <div className="ico"><Icon name="document" size={16} /></div>
                <div>
                  <div className="name" style={{ fontWeight: 500 }}>Belum ada materi yang kamu buka</div>
                  <div className="sub">Buka salah satu koleksi di atas — riwayatnya muncul di sini.</div>
                </div>
              </div>
            ) : (
              recentRows.map(({ m, at }) => (
                <Link key={m.id} href={m.href!} className="recent-row" onClick={() => recordOpen(m.id)}>
                  <div className="ico">
                    <Icon name={m.icon} size={16} />
                  </div>
                  <div>
                    <div className="name">{m.title}</div>
                    <div className="sub">{m.label}</div>
                  </div>
                  <span className="db-pill static accent">{PHASE_LABEL[m.phase] ?? "Umum"}</span>
                  <span className="when">{fmtAgo(at, now)}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h2>Untuk kamu</h2>
          </div>
          <div className="materi-recommend">
            {rec ? (
              <>
                <span className="tag">Direkomendasikan</span>
                <h3>Sesi {rec.session.sessionNum} — {rec.session.topic || "materi sesi"}</h3>
                <p>
                  Sesi {firstName(rec.menteeName)} berikutnya
                  {rec.ms !== Number.POSITIVE_INFINITY ? ` ${fmtWhen(rec.ms, now)}` : ""}. Buka materi sesi ini sebelum kalian ngobrol.
                </p>
                <div className="ctx">
                  <b>Kenapa ini muncul:</b> {firstName(rec.menteeName)} (mentee kamu) ada di Sesi {rec.session.sessionNum} berikutnya. Buka panduan kurikulum untuk sesi ini.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    href={`/dashboard/curriculum#session-${rec.session.sessionNum}`}
                    className="db-btn db-btn-primary"
                    onClick={() => recordOpen("curriculum")}
                  >
                    Buka materi sesi
                  </Link>
                  <Link href={`/dashboard/sesi/${rec.session.id}`} className="db-btn-ghost">
                    Buka sesi
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className="tag">Direkomendasikan</span>
                <h3>Mulai dari Curriculum Guide</h3>
                <p>Kerangka penuh 10-sesi adalah peta jalan kamu sebagai mentor. Buka sebelum sesi pertama dengan mentee baru.</p>
                <div className="ctx">
                  <b>Kenapa ini muncul:</b> kamu mentor baru atau punya mentee yang belum mulai sesi 1. Materi ini paling sering jadi rujukan.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/dashboard/curriculum" className="db-btn db-btn-primary" onClick={() => recordOpen("curriculum")}>Buka panduan</Link>
                </div>
              </>
            )}
          </div>

          <div className="cmd-hint">
            <kbd>⌘</kbd>
            <kbd>K</kbd>
            <span>buka pencarian materi dari mana saja — tanpa pindah halaman. (segera)</span>
          </div>
        </div>
      </div>

      {/* ── Curriculum table-of-contents modal ─────────────────────
          Triggered by "Daftar isi" on the hero. Lets the mentor scan + jump
          to the curriculum without leaving Materi. */}
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
