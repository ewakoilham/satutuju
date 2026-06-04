"use client";

import { useState } from "react";
import { CURRICULUM, PHASES, DOCUMENT_CATEGORIES, type SessionTemplate } from "@/lib/curriculum";
import Icon from "@/components/ui/Icon";
import Link from "next/link";
import { useUser } from "@/lib/hooks";

/* ── Phase colour map (matches globals.css semantic vars) ──────────── */
const PHASE_COLORS: Record<string, {
  bg: string; border: string; text: string; icon: string;
  badge: string; badgeText: string; tabActive: string; tabText: string;
}> = {
  discovery: {
    bg: "bg-surface-blue", border: "border-surface-blue-border",
    text: "text-text-blue", icon: "text-text-blue",
    badge: "bg-surface-blue", badgeText: "text-text-blue",
    tabActive: "bg-surface-blue border-surface-blue-border text-text-blue",
    tabText: "text-text-blue",
  },
  planning: {
    bg: "bg-surface-amber", border: "border-surface-amber-border",
    text: "text-text-amber", icon: "text-text-amber",
    badge: "bg-surface-amber", badgeText: "text-text-amber",
    tabActive: "bg-surface-amber border-surface-amber-border text-text-amber",
    tabText: "text-text-amber",
  },
  writing: {
    bg: "bg-surface-purple", border: "border-surface-purple-border",
    text: "text-text-purple", icon: "text-text-purple",
    badge: "bg-surface-purple", badgeText: "text-text-purple",
    tabActive: "bg-surface-purple border-surface-purple-border text-text-purple",
    tabText: "text-text-purple",
  },
  execution: {
    bg: "bg-surface-orange", border: "border-surface-orange-border",
    text: "text-text-orange", icon: "text-text-orange",
    badge: "bg-surface-orange", badgeText: "text-text-orange",
    tabActive: "bg-surface-orange border-surface-orange-border text-text-orange",
    tabText: "text-text-orange",
  },
  closing: {
    bg: "bg-surface-green", border: "border-surface-green-border",
    text: "text-text-green", icon: "text-text-green",
    badge: "bg-surface-green", badgeText: "text-text-green",
    tabActive: "bg-surface-green border-surface-green-border text-text-green",
    tabText: "text-text-green",
  },
};

const PHASE_KEYS = Object.keys(PHASES) as (keyof typeof PHASES)[];

/* ── Unique docs across the whole curriculum ───────────────────────── */
const ALL_DOCS = Array.from(
  new Set(CURRICULUM.flatMap((s) => s.docChecklist))
);

/* ── Session card (expandable) ─────────────────────────────────────── */
function SessionCard({
  session,
  expanded,
  onToggle,
  showMentorPrep,
}: {
  session: SessionTemplate;
  expanded: boolean;
  onToggle: () => void;
  showMentorPrep: boolean;
}) {
  const c = PHASE_COLORS[session.phase];

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${c.border} ${expanded ? c.bg : "bg-surface border-border"}`}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:opacity-90 transition"
      >
        {/* Session number badge */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${expanded ? `${c.badge} ${c.badgeText}` : "bg-surface-elevated text-text-muted"}`}>
          {session.sessionNum}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${c.badge} ${c.badgeText}`}>
              {session.phaseEmoji} {session.phaseLabel}
            </span>
            <span className="text-xs text-text-muted-2">{session.duration} mnt</span>
          </div>
          <p className={`text-sm font-semibold mt-0.5 ${expanded ? c.text : "text-foreground"}`}>
            Sesi {session.sessionNum}: {session.topic}
          </p>
        </div>

        <Icon
          name="chevron-down"
          size={16}
          className={`flex-shrink-0 transition-transform text-text-muted-2 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in-up">

          {/* Tujuan */}
          <div className="md:col-span-2 space-y-1">
            <div className={`flex items-center gap-1.5 ${c.text}`}>
              <Icon name="lightbulb" size={13} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Tujuan</span>
            </div>
            <p className="text-sm text-foreground">{session.objective}</p>
          </div>

          {/* Hasil */}
          <div className="space-y-2">
            <div className={`flex items-center gap-1.5 ${c.text}`}>
              <Icon name="clipboard-check" size={13} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Hasil</span>
            </div>
            <ul className="space-y-1.5">
              {session.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <Icon name="check" size={13} className={`mt-0.5 flex-shrink-0 ${c.icon}`} />
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {/* Persiapan Mentee */}
          <div className="space-y-2">
            <div className={`flex items-center gap-1.5 ${c.text}`}>
              <Icon name="user" size={13} />
              <span className="text-[11px] font-bold uppercase tracking-wider">Persiapan Mentee</span>
            </div>
            <ul className="space-y-1.5">
              {session.menteePrep.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <Icon name="chevron-right" size={13} className={`mt-0.5 flex-shrink-0 ${c.icon}`} />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Persiapan Mentor — only for mentor/admin */}
          {showMentorPrep && session.mentorPrep.length > 0 && (
            <div className="space-y-2">
              <div className={`flex items-center gap-1.5 ${c.text}`}>
                <Icon name="graduation" size={13} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Persiapan Mentor</span>
              </div>
              <ul className="space-y-1.5">
                {session.mentorPrep.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Icon name="chevron-right" size={13} className={`mt-0.5 flex-shrink-0 ${c.icon}`} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dokumen Dibutuhkan */}
          {session.docChecklist.length > 0 && (
            <div className="space-y-2">
              <div className={`flex items-center gap-1.5 ${c.text}`}>
                <Icon name="document" size={13} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Dokumen Dibutuhkan</span>
              </div>
              <ul className="space-y-1.5">
                {session.docChecklist.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Icon name="document" size={13} className={`mt-0.5 flex-shrink-0 ${c.icon}`} />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */
export default function CurriculumPage() {
  const { user } = useUser();
  const [selectedPhase, setSelectedPhase] = useState<string | "all">("all");
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [view, setView] = useState<"sessions" | "documents">("sessions");

  const showMentorPrep = user?.role === "mentor" || user?.role === "admin";

  const filteredSessions = selectedPhase === "all"
    ? CURRICULUM
    : CURRICULUM.filter((s) => s.phase === selectedPhase);

  const phaseStats = PHASE_KEYS.map((key) => ({
    key,
    ...PHASES[key],
    sessions: CURRICULUM.filter((s) => s.phase === key),
    totalDocs: Array.from(new Set(
      CURRICULUM.filter((s) => s.phase === key).flatMap((s) => s.docChecklist)
    )).length,
  }));

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page header — matches the redesigned page-head / sesi-title hero */}
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">
            <Link href="/dashboard/resources">← Materi</Link>
          </div>
          <h1 className="sesi-title">
            Panduan Kurikulum <span className="lede">10 sesi, 5 fase.</span>
          </h1>
          <p className="sesi-sub">
            10 sesi mentoring dalam 5 fase — dari awal sampai akhir perjalanan mentee.
          </p>
        </div>
      </div>

      {/* Phase overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {phaseStats.map(({ key, label, emoji, sessions: ps, totalDocs }) => {
          const c = PHASE_COLORS[key];
          const isActive = selectedPhase === key;
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedPhase(isActive ? "all" : key);
                setExpandedSession(null);
                setView("sessions");
              }}
              className={`rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? `${c.bg} ${c.border}`
                  : "bg-surface border-border hover:border-border-hover hover:bg-surface-elevated"
              }`}
            >
              <span className="text-xl">{emoji}</span>
              <p className={`text-sm font-semibold mt-1 ${isActive ? c.text : "text-foreground"}`}>
                {label}
              </p>
              <p className={`text-xs mt-0.5 ${isActive ? c.text : "text-text-muted"}`}>
                {ps.length} sesi · {totalDocs} dok
              </p>
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-surface-elevated rounded-xl w-fit border border-border">
        {(["sessions", "documents"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              view === v
                ? "bg-surface text-foreground shadow-[var(--shadow-xs)]"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            {v === "sessions" ? "Sesi" : "Dokumen"}
          </button>
        ))}
      </div>

      {/* ── Sessions view ──────────────────────────────────────────── */}
      {view === "sessions" && (
        <div className="space-y-3">
          {selectedPhase !== "all" && (
            <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${PHASE_COLORS[selectedPhase].bg} ${PHASE_COLORS[selectedPhase].border}`}>
              <span className={`text-sm font-medium ${PHASE_COLORS[selectedPhase].text}`}>
                Menampilkan fase {PHASES[selectedPhase as keyof typeof PHASES].label}
                · {filteredSessions.length} sesi
              </span>
              <button
                onClick={() => { setSelectedPhase("all"); setExpandedSession(null); }}
                className={`text-xs underline ${PHASE_COLORS[selectedPhase].text}`}
              >
                Tampilkan semua
              </button>
            </div>
          )}

          {filteredSessions.map((session) => (
            <SessionCard
              key={session.sessionNum}
              session={session}
              expanded={expandedSession === session.sessionNum}
              onToggle={() =>
                setExpandedSession(
                  expandedSession === session.sessionNum ? null : session.sessionNum
                )
              }
              showMentorPrep={showMentorPrep}
            />
          ))}
        </div>
      )}

      {/* ── Documents view ─────────────────────────────────────────── */}
      {view === "documents" && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Daftar lengkap dokumen yang perlu disiapkan mentee sepanjang program.
          </p>

          {/* By phase */}
          {(selectedPhase === "all" ? PHASE_KEYS : [selectedPhase as keyof typeof PHASES]).map((phaseKey) => {
            const phaseSessions = CURRICULUM.filter((s) => s.phase === phaseKey);
            const phaseDocs = Array.from(new Set(phaseSessions.flatMap((s) => s.docChecklist)));
            if (phaseDocs.length === 0) return null;
            const c = PHASE_COLORS[phaseKey];
            const p = PHASES[phaseKey];
            return (
              <div key={phaseKey} className={`rounded-2xl border ${c.border} ${c.bg}`}>
                <div className="px-5 py-3 border-b border-inherit flex items-center gap-2">
                  <span className="text-base">{p.emoji}</span>
                  <span className={`text-sm font-semibold ${c.text}`}>Fase {p.label}</span>
                  <span className={`text-xs ml-auto ${c.text} opacity-70`}>
                    Sesi {phaseSessions[0].sessionNum}–{phaseSessions[phaseSessions.length - 1].sessionNum}
                  </span>
                </div>
                <div className="px-5 py-4 space-y-3">
                  {phaseSessions.map((session) => (
                    session.docChecklist.length > 0 && (
                      <div key={session.sessionNum}>
                        <p className="text-xs text-text-muted mb-1.5">
                          Sesi {session.sessionNum}: {session.topic}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {session.docChecklist.map((doc, i) => (
                            <span
                              key={i}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${c.badge} ${c.badgeText} ${c.border}`}
                            >
                              <Icon name="document" size={11} />
                              {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="card rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="clipboard-check" size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Total: {ALL_DOCS.length} dokumen unik</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <span key={cat.value} className="text-xs px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-text-muted-3">
                  {cat.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
