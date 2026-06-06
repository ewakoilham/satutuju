"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CURRICULUM, DOCUMENT_CATEGORIES, type SessionTemplate } from "@/lib/curriculum";

/* ──────────────────────────────────────────────────────────────────────
   Panduan Kurikulum — the curriculum "journey" reference.
   Hi-fi rebuild of handoff_kurikulum (Satu Tuju Dashboard-8).
   Read-only: the 10-session / 5-phase mentorship arc shown as one trail.
   Styles live in dashboard.css under the `.kc-page` scope.
   ──────────────────────────────────────────────────────────────────── */

type PhaseKey = "discovery" | "planning" | "writing" | "execution" | "closing";

const ORDER: PhaseKey[] = ["discovery", "planning", "writing", "execution", "closing"];

/* Inline phase line-icons (kept to match the handoff pixel-for-pixel). */
const PHASE_ICON: Record<PhaseKey, React.ReactNode> = {
  discovery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
  ),
  planning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 3 4v14l6 2 6-2 6 2V6l-6-2-6 2Z" /><path d="M9 4v14M15 6v14" /></svg>
  ),
  writing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
  ),
  execution: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>
  ),
  closing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 3-1 1 1 0 0 1 1 .8V14a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1" /></svg>
  ),
};

const PHASE_NAME: Record<PhaseKey, string> = {
  discovery: "Discovery",
  planning: "Planning",
  writing: "Writing",
  execution: "Execution",
  closing: "Closing",
};

/* Detail-section markers */
const I_GOAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></svg>
);
const I_HASIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 5-5" /><path d="M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" /><path d="M16 4h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
);
const I_MENTEE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
const I_MENTOR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 9 12 5 2 9l10 4 10-4Z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></svg>
);
const I_FILE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
);
const M_CHK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const M_CHEV = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);
const I_PIN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.6-7-11a7 7 0 1 1 14 0c0 4.4-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
);
const I_FLAG = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 3-1 1 1 0 0 1 1 .8V14a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1" /></svg>
);
const I_CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

function fmtDur(m: number): string {
  if (m >= 60) return m % 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m / 60} jam`;
  return `${m} menit`;
}

const byPhase = (p: PhaseKey) => CURRICULUM.filter((s) => s.phase === p);
const docCount = (sessions: SessionTemplate[]) => sessions.reduce((a, s) => a + s.docChecklist.length, 0);
const TOTAL_DOCS = CURRICULUM.reduce((a, s) => a + s.docChecklist.length, 0);

/* ── Detail section (Hasil / Persiapan mentee / mentor / Dokumen) ─────── */
function DetailSection({
  icon, label, items, marker, variant,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  marker: React.ReactNode;
  variant?: "doc";
}) {
  return (
    <div className="det-sec">
      <div className="det-h">{icon} {label}</div>
      <ul className={`det-list${variant === "doc" ? " doc" : ""}`}>
        {items.map((t, i) => (
          <li key={i}><span className="mk">{marker}</span>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/* ── Session row + expanding panel ───────────────────────────────────── */
function SessionRow({
  session, open, onToggle,
}: {
  session: SessionTemplate;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`sess${open ? " open" : ""}`} id={`session-${session.sessionNum}`}>
      <span className="sess-node">{session.sessionNum}</span>
      <button type="button" className="sess-row" onClick={onToggle} aria-expanded={open}>
        <div className="sess-body">
          <div className="sess-title">{session.topic}</div>
          <div className="sess-line">
            <span className="sess-meta">{I_CLOCK}{fmtDur(session.duration)}</span>
            <span className="sess-meta">{I_FILE}{session.docChecklist.length} dokumen</span>
          </div>
        </div>
        <span className="sess-chev">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </button>
      {open && (
        <div className="sess-panel">
          <div className="det-goal">
            <div className="det-h">{I_GOAL} Tujuan</div>
            <p>{session.objective}</p>
          </div>
          <div className="det-grid">
            <DetailSection icon={I_HASIL} label="Hasil" items={session.deliverables} marker={M_CHK} />
            <DetailSection icon={I_MENTEE} label="Persiapan mentee" items={session.menteePrep} marker={M_CHEV} />
            <DetailSection icon={I_MENTOR} label="Persiapan mentor" items={session.mentorPrep} marker={M_CHEV} />
            <DetailSection icon={I_FILE} label="Dokumen dibutuhkan" items={session.docChecklist} marker={I_FILE} variant="doc" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function CurriculumPage() {
  const [tab, setTab] = useState<"sesi" | "dok">("sesi");
  const [open, setOpen] = useState<Set<number>>(() => new Set([1]));
  const [activeStation, setActiveStation] = useState<PhaseKey | null>(null);
  const chapterRefs = useRef<Partial<Record<PhaseKey, HTMLElement | null>>>({});

  const toggleSession = useCallback((n: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  const scrollToPhase = useCallback((p: PhaseKey) => {
    setTab("sesi");
    setActiveStation(p);
    requestAnimationFrame(() => {
      const el = chapterRefs.current[p];
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
    });
  }, []);

  /* Deep links from Materi: /dashboard/curriculum#session-N (also #sesi-N). */
  useEffect(() => {
    const m = window.location.hash.match(/#(?:session|sesi)-(\d+)/);
    if (!m) return;
    const n = Number(m[1]);
    if (!CURRICULUM.some((s) => s.sessionNum === n)) return;
    // Defer state + scroll out of the synchronous effect body (avoids
    // cascading renders, and keeps `window` access client-only).
    requestAnimationFrame(() => {
      setTab("sesi");
      setOpen((prev) => new Set(prev).add(n));
      const el = document.getElementById(`session-${n}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
    });
  }, []);

  return (
    <div className="kc-page">
      {/* Breadcrumb */}
      <Link className="kc-back" href="/dashboard/resources">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Materi
      </Link>

      {/* Header */}
      <div className="kc-head">
        <div>
          <h1>Panduan Kurikulum <em>10 sesi, 5 fase.</em></h1>
          <p className="sub">
            Kerangka penuh mentoring Satu Tuju — dari kenalan sampai mentee submit aplikasi.
            Pakai apa adanya, atau sesuaikan jumlah sesi per mentee.
          </p>
        </div>
      </div>

      {/* Route map */}
      <div className="journey">
        <div className="route">
          <div className="route-caps">
            <span><b>Mulai</b> · mentee di-match</span>
            <span>submit aplikasi · <b>selesai</b></span>
          </div>
          <div className="route-grid">
            {ORDER.map((p, i) => {
              const list = byPhase(p);
              return (
                <button
                  key={p}
                  type="button"
                  className={`station ph-${p}${activeStation === p ? " active" : ""}`}
                  onClick={() => scrollToPhase(p)}
                >
                  <span className="station-node">{PHASE_ICON[p]}<span className="station-no">{i + 1}</span></span>
                  <span className="station-name">{PHASE_NAME[p]}</span>
                  <span className="station-meta"><b>{list.length} sesi</b> · {docCount(list)} dok</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="kc-tabs">
        <button type="button" className={`kc-tab${tab === "sesi" ? " on" : ""}`} onClick={() => setTab("sesi")}>Sesi</button>
        <button type="button" className={`kc-tab${tab === "dok" ? " on" : ""}`} onClick={() => setTab("dok")}>Dokumen</button>
      </div>

      {/* Pane: Sesi (the trail) */}
      <div id="pane-sesi" style={{ display: tab === "sesi" ? undefined : "none" }}>
        <div className="trail">
          <div className="trail-cap start">
            <span className="cap-node">{I_PIN}</span>
            <span className="cap-label"><b>Mulai</b> — mentee baru di-match dengan kamu</span>
          </div>

          {ORDER.map((p, i) => {
            const list = byPhase(p);
            const totMin = list.reduce((a, s) => a + s.duration, 0);
            return (
              <section
                key={p}
                className={`phase-chapter ph-${p}`}
                ref={(el) => { chapterRefs.current[p] = el; }}
              >
                <div className="chapter-head">
                  <span className="chapter-node">{PHASE_ICON[p]}</span>
                  <div className="chapter-txt">
                    <span className="chapter-no">Fase 0{i + 1}</span>
                    <h2 className="chapter-name">{PHASE_NAME[p]}</h2>
                  </div>
                  <span className="phase-spacer" />
                  <span className="chapter-sub"><b>{list.length} sesi</b> · {docCount(list)} dokumen · {fmtDur(totMin)}</span>
                </div>
                <div className="chapter-sessions">
                  {list.map((s) => (
                    <SessionRow
                      key={s.sessionNum}
                      session={s}
                      open={open.has(s.sessionNum)}
                      onToggle={() => toggleSession(s.sessionNum)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="trail-cap end">
            <span className="cap-node">{I_FLAG}</span>
            <span className="cap-label"><b>Selesai</b> — mentee submit aplikasi 🎉</span>
          </div>
        </div>
      </div>

      {/* Pane: Dokumen (grouped by phase) */}
      <div id="pane-dok" style={{ display: tab === "dok" ? undefined : "none" }}>
        {ORDER.map((p) => {
          const list = byPhase(p);
          const first = list[0].sessionNum;
          const last = list[list.length - 1].sessionNum;
          return (
            <div key={p} className={`dok-phase ph-${p}`}>
              <div className="dok-phase-head">
                <span className="dph-ic">{PHASE_ICON[p]}</span>
                <span className="dph-name">Fase {PHASE_NAME[p]}</span>
                <span className="phase-spacer" />
                <span className="dph-range">Sesi {first}–{last}</span>
              </div>
              <div className="dok-phase-body">
                {list.map((s) => (
                  <div key={s.sessionNum} className="dok-sess">
                    <div className="ds-title">Sesi {s.sessionNum}: {s.topic}</div>
                    <div className="dok-chips">
                      {s.docChecklist.map((d, i) => (
                        <span key={i} className="dok-chip">{I_FILE}{d}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="dok-total">
          <div className="dok-total-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            Total: {TOTAL_DOCS} dokumen unik
          </div>
          <div className="dok-total-chips">
            {DOCUMENT_CATEGORIES.map((c) => (
              <span key={c.value} className="dok-cat">{c.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="kc-foot">
        <div className="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
        </div>
        <div className="txt">
          <h4>Kurikulum ini fleksibel</h4>
          <p>10 sesi adalah saran default. Saat menyusun rencana untuk mentee baru, kamu bisa duplikat, ganti judul, atur ulang, atau kurangi sampai minimal 5 sesi sesuai kebutuhan mereka.</p>
        </div>
        <Link href="/dashboard/mentee" className="kc-btn kc-btn-outline">Susun rencana →</Link>
      </div>
    </div>
  );
}
