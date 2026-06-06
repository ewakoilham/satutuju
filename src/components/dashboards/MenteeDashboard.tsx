"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/hooks";
import { getCachedMenteePairing, refreshMenteePairing, invalidateMenteePairing } from "@/lib/mentee-pairing-cache";
import { CURRICULUM, PHASES } from "@/lib/curriculum";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  currentWibHour,
  phaseFromHour,
  todConfig,
  TodIcon,
  type TodPhase,
} from "@/lib/time-of-day";

/* ─── Data shapes (mentee POV — from /api/pairings/[id]) ───────────── */

interface Mentor {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}
interface SessionRow {
  id: string;
  sessionNum: number;
  status: string; // "upcoming" | "scheduled" | "completed" | "skipped"
  phase: string;
  topic?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  durationMinutes?: number | null; // published from the mentor's session plan
  objective?: string | null;
}
interface TaskRow {
  id: string;
  title: string;
  status: string; // "pending" | "in_progress" | "completed" | "overdue"
  dueDate?: string | null;
  sessionNum?: number | null;
}
interface DocRow {
  id: string;
  name: string;
  category?: string;
  status: string; // "uploaded" | "under_review" | "needs_revision" | "approved"
}
interface MenteeProfile {
  intendedStudyProgram?: string | null;
  preferredDestinations?: string | null;
}
interface Pairing {
  id: string;
  status: string;
  targetProgram?: string | null;
  mentor: Mentor;
  sessions: SessionRow[];
  tasks: TaskRow[];
  documents: DocRow[];
  menteeProfile?: MenteeProfile | null;
}

/* ─── Helpers (shared idiom with MentorDashboard) ─────────────────── */

const ID_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function firstName(name?: string | null): string {
  return (name || "kamu").trim().split(/\s+/)[0] || "kamu";
}
function fmtDateEyebrow(d: Date): string {
  const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getDay()];
  return `${dayName}, ${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDay(d: Date): { day: string; mo: string } {
  return { day: String(d.getDate()), mo: ID_DAYS[d.getDay()] };
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtShortDate(d: Date): string {
  return `${ID_DAYS[d.getDay()]} ${d.getDate()} ${ID_MONTHS[d.getMonth()]}`;
}
function daysFromNow(d: Date, now: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}
function relDays(d: Date, now: Date): string {
  const n = daysFromNow(d, now);
  if (n < 0) return "sudah lewat";
  if (n === 0) return "hari ini";
  if (n === 1) return "besok";
  return `${n} hari lagi`;
}
function durationFor(s: { sessionNum: number; durationMinutes?: number | null }): number {
  // Prefer the duration published from the mentor's plan; fall back to the
  // curriculum template for sessions not yet (re)finalized.
  return s.durationMinutes ?? CURRICULUM.find((c) => c.sessionNum === s.sessionNum)?.duration ?? 60;
}
function phaseLabel(phase?: string | null): string {
  if (!phase) return "";
  return PHASES[phase as keyof typeof PHASES]?.label ?? phase;
}

const PENDING_TASK = new Set(["pending", "in_progress", "overdue"]);

/* ─── Beranda (mentee home) ───────────────────────────────────────── */

export default function MenteeDashboard() {
  const { user } = useUser();
  // Seed from the shared cache so revisiting Beranda renders instantly; a
  // background refetch below keeps it fresh.
  const cachedPairing = getCachedMenteePairing();
  const [pairing, setPairing] = useState<Pairing | null>(
    cachedPairing !== undefined ? (cachedPairing as Pairing | null) : null,
  );
  const [profile, setProfile] = useState<MenteeProfile | null>(null);
  const [loading, setLoading] = useState(cachedPairing === undefined);

  // Local task overrides so checkbox toggles feel instant; key → status.
  const [taskOverride, setTaskOverride] = useState<Record<string, string>>({});

  const [phaseOverride, setPhaseOverride] = useState<TodPhase | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Always revalidate in the background (stale-while-revalidate), even when
    // we rendered from cache — so any staleness self-corrects.
    Promise.all([
      refreshMenteePairing().then((p) => (p as Pairing) || null).catch(() => null),
      fetch("/api/profile")
        .then((r) => r.json())
        .then((d) => d.profile || null)
        .catch(() => null),
    ]).then(([p, prof]) => {
      setPairing(p);
      setProfile(prof);
    }).finally(() => setLoading(false));
  }, []);

  const phase = phaseOverride ?? phaseFromHour(currentWibHour(now));
  const tod = todConfig(phase);

  /* ── Derived data (memoised) ──────────────────────────────────── */
  const derived = useMemo(() => {
    if (!pairing) return null;
    const sessions = [...pairing.sessions].sort((a, b) => a.sessionNum - b.sessionNum);
    const tasks = pairing.tasks.map((t) => ({ ...t, status: taskOverride[t.id] ?? t.status }));
    const docs = pairing.documents;

    const total = sessions.length || CURRICULUM.length;
    const completed = sessions.filter((s) => s.status === "completed").length;
    const next =
      sessions.find((s) => s.status === "scheduled") ||
      sessions.find((s) => s.status === "upcoming") ||
      sessions.find((s) => s.status !== "completed") ||
      null;
    const nextIdx = next ? sessions.findIndex((s) => s.id === next.id) : completed;

    const underReview = docs.filter((d) => d.status === "under_review").length;
    const needsRevision = docs.filter((d) => d.status === "needs_revision").length;
    const docsWaiting = underReview + needsRevision;
    const docAction = docs.find((d) => d.status === "needs_revision") || docs.find((d) => d.status === "under_review") || null;

    // Upcoming, scheduled sessions for the "Jadwal kamu" list.
    const upcoming = sessions
      .filter((s) => s.scheduledAt && new Date(s.scheduledAt).getTime() >= now.getTime() && s.status !== "completed")
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, 3);

    // Nearest task deadline.
    const nextDeadline = tasks
      .filter((t) => PENDING_TASK.has(t.status) && t.dueDate)
      .map((t) => ({ t, due: new Date(t.dueDate!) }))
      .filter(({ due }) => !isNaN(due.getTime()))
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0] || null;

    const pendingTasks = tasks.filter((t) => PENDING_TASK.has(t.status));
    const doneTasks = tasks.filter((t) => t.status === "completed").length;
    // Show pending items first, completed (struck-through) after — like the
    // handoff checklist, so toggling a row gives the satisfying strike instead
    // of making it disappear. Cap so the card stays compact.
    const displayTasks = [...tasks]
      .sort((a, b) => (a.status === "completed" ? 1 : 0) - (b.status === "completed" ? 1 : 0))
      .slice(0, 6);

    const target =
      profile?.intendedStudyProgram ||
      pairing.menteeProfile?.intendedStudyProgram ||
      pairing.targetProgram ||
      null;
    const destinations =
      profile?.preferredDestinations || pairing.menteeProfile?.preferredDestinations || null;

    return {
      sessions, tasks, docs, total, completed, next, nextIdx,
      underReview, needsRevision, docsWaiting, docAction,
      upcoming, nextDeadline, pendingTasks, displayTasks, doneTasks, target, destinations,
    };
  }, [pairing, taskOverride, profile, now]);

  /* ── Task toggle (optimistic + persisted) ─────────────────────── */
  async function toggleTask(t: TaskRow) {
    const nextStatus = t.status === "completed" ? "pending" : "completed";
    setTaskOverride((prev) => ({ ...prev, [t.id]: nextStatus }));
    try {
      await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      // Mutation: drop the shared cache so other tabs (e.g. Dokumen) refetch.
      invalidateMenteePairing();
    } catch {
      // Revert on failure.
      setTaskOverride((prev) => ({ ...prev, [t.id]: t.status }));
    }
  }

  /* ── Render ────────────────────────────────────────────────────── */
  if (loading) return <SkeletonDashboard />;

  if (!pairing || !derived) {
    return (
      <EmptyState
        icon="map"
        title="Perjalanan kamu belum dimulai"
        description="Kamu akan segera dipasangkan dengan seorang mentor. Tunggu sebentar, ya!"
      />
    );
  }

  const d = derived;
  const mentorName = pairing.mentor.name;
  const mentorFirst = firstName(mentorName);
  const mentorInitials = initials(mentorName);
  const pairHref = `/dashboard/pairings/${pairing.id}`;
  const progressPct = Math.round((d.completed / d.total) * 100);

  const greetSubBits: React.ReactNode[] = [
    <><b>{d.completed} dari {d.total}</b> sesi selesai</>,
    d.docsWaiting > 0 ? <><b>{d.docsWaiting} dokumen</b> ditunggu {mentorFirst}</> : null,
    d.target ? <>target <b>{d.target}{d.destinations ? ` · ${d.destinations}` : ""}</b></> : null,
  ].filter(Boolean) as React.ReactNode[];

  const nextScheduled = d.next?.scheduledAt ? new Date(d.next.scheduledAt) : null;
  const validNextDate = nextScheduled && !isNaN(nextScheduled.getTime()) ? nextScheduled : null;
  // A non-completed session whose scheduled date already passed isn't "next" —
  // it's overdue / not yet wrapped up. Keep the card's message to a single
  // accurate signal instead of "Sesi berikutnya" + "sudah lewat".
  const nextIsPast = validNextDate ? daysFromNow(validNextDate, now) < 0 : false;

  return (
    <>
      <div className="home-grid">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="col-main">
          <div className="greet-block">
            <span className="eyebrow primary">{fmtDateEyebrow(now)}</span>
            <h1 className="greet">
              <span className="lede">{tod.greet}, {firstName(user?.name)}.</span>
              <span className={`tod ${tod.toneClass}`}><TodIcon phase={phase} /></span>
              <br />
              {d.next
                ? nextIsPast
                  ? `Sesi ${d.next.sessionNum} bareng ${mentorFirst} belum selesai.`
                  : `Sesi ${d.next.sessionNum} bareng ${mentorFirst}${validNextDate ? `, ${relDays(validNextDate, now)}` : ""}.`
                : "Semua sesi sudah selesai — kerja bagus!"}
            </h1>
            {greetSubBits.length > 0 && (
              <div className="greet-sub">
                {greetSubBits.flatMap((bit, i) =>
                  i === 0
                    ? [<span key={`b-${i}`}>{bit}</span>]
                    : [<span key={`d-${i}`} className="dot" />, <span key={`b-${i}`}>{bit}</span>]
                )}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="stats">
            <div className="stat">
              <div className="lbl">Progress mentorship</div>
              <div className="val">
                {String(d.completed).padStart(2, "0")} <span className="of">/ {d.total}</span>
              </div>
              <div className="track"><i style={{ width: `${progressPct}%` }} /></div>
            </div>
            <div className="stat">
              <div className="lbl">Dokumen aktif</div>
              <div className="val">{String(d.docs.length).padStart(2, "0")}</div>
              <div className={`delta${d.docsWaiting > 0 ? " warn" : ""}`}>
                {d.docsWaiting > 0
                  ? [d.underReview > 0 ? `${d.underReview} nunggu review` : null, d.needsRevision > 0 ? `${d.needsRevision} perlu revisi` : null].filter(Boolean).join(" · ")
                  : d.docs.length > 0 ? "semua terkirim" : "belum ada dokumen"}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">Deadline terdekat</div>
              {d.nextDeadline ? (
                <>
                  <div className="val">{Math.max(0, daysFromNow(d.nextDeadline.due, now))}<span className="unit">hari</span></div>
                  <div className="delta">{d.nextDeadline.t.title} · {fmtShortDate(d.nextDeadline.due)}</div>
                </>
              ) : (
                <>
                  <div className="val">—</div>
                  <div className="delta">tidak ada deadline aktif</div>
                </>
              )}
            </div>
          </div>

          {/* Sesi berikutnya */}
          <section className="section">
            <div className="section-head">
              <h2>{nextIsPast ? "Sesi belum selesai" : "Sesi berikutnya"}</h2>
              {validNextDate && !nextIsPast && <span className="meta">{relDays(validNextDate, now)}</span>}
            </div>

            {d.next ? (
              <div className="today">
                <div className="today-blob" />
                <div className="today-content">
                  <div className="today-head">
                    <span className="badge-pulse">
                      <span className="pulse-dot" />
                      Sesi {d.next.sessionNum}{validNextDate ? ` · ${fmtShortDate(validNextDate)}` : ""}
                    </span>
                    {validNextDate ? (
                      <span className="today-when">
                        mulai <b>{fmtTime(validNextDate)} WIB</b> · Google Meet · {durationFor(d.next)} menit
                      </span>
                    ) : (
                      <span className="today-when">belum dijadwalkan</span>
                    )}
                  </div>

                  <div className="today-row">
                    <div className="av-grad lg av-c5">{mentorInitials}</div>
                    <div>
                      {phaseLabel(d.next.phase) && <span className="eyebrow primary">{phaseLabel(d.next.phase)}</span>}
                      <h3>{d.next.topic || "Sesi mentoring"}</h3>
                      <p className="who">Bersama <b>{mentorName}</b> · mentormu</p>
                    </div>
                    <div className="actions">
                      <Link href={`/dashboard/sesi/${d.next.id}`} className="db-btn db-btn-outline sm">Lihat persiapan</Link>
                      <Link href={`/dashboard/sesi/${d.next.id}`} className="db-btn db-btn-primary">
                        <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m23 7-7 5 7 5V7Z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                        Gabung sesi
                      </Link>
                    </div>
                  </div>

                  {d.docAction && (
                    <div className="today-warn">
                      <span className="ic">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
                      </span>
                      <span>
                        <b>{mentorFirst} {d.docAction.status === "needs_revision" ? "minta revisi" : "menunggu review"}:</b>{" "}
                        {d.docAction.name}. Beresin sebelum sesi biar pembahasannya lebih nyambung.
                      </span>
                      <Link href={pairHref} className="nudge">
                        {d.docAction.status === "needs_revision" ? "Perbaiki sekarang" : "Lihat dokumen"}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="today">
                <div className="today-blob" />
                <div className="today-content">
                  <div className="today-head"><span className="eyebrow primary">Selesai</span></div>
                  <div className="today-row">
                    <div className="av-grad lg av-c5">{mentorInitials}</div>
                    <div>
                      <h3>Semua sesi sudah kelar 🎉</h3>
                      <p className="who">Tinjau kembali catatan & dokumen kamu bareng <b>{mentorName}</b>.</p>
                    </div>
                    <div className="actions">
                      <Link href={pairHref} className="db-btn db-btn-outline sm">Lihat perjalanan</Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Tugas dari mentor */}
          {d.tasks.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>Tugas dari {mentorFirst}</h2>
                <Link href={pairHref}>Lihat semua →</Link>
              </div>

              <div className="tasks">
                <div className="tasks-head">
                  <h3>Yang perlu kamu kerjakan</h3>
                  <span className="from">diminta {mentorFirst}</span>
                  <span className="count">{d.doneTasks} / {d.tasks.length} selesai</span>
                </div>

                {d.displayTasks.map((t) => {
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  const validDue = due && !isNaN(due.getTime()) ? due : null;
                  const soon = validDue ? daysFromNow(validDue, now) <= 3 : false;
                  return (
                    <div
                      key={t.id}
                      className={`task${t.status === "completed" ? " done" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleTask(t)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTask(t); } }}
                    >
                      <span className="ck">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11" /></svg>
                      </span>
                      <div className="body">
                        <div className="t-title">{t.title}</div>
                        <div className="t-meta">
                          {validDue
                            ? <span className={`due${soon ? " soon" : ""}`}>jatuh tempo · {fmtShortDate(validDue)}</span>
                            : <span className="due">tanpa tenggat</span>}
                          {t.sessionNum != null && <><span className="dot" /><span>Sesi {t.sessionNum}</span></>}
                        </div>
                      </div>
                      <Link href={pairHref} className="cta" onClick={(e) => e.stopPropagation()}>Buka</Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Jadwal kamu */}
          <section className="section">
            <div className="section-head">
              <h2>Jadwal kamu</h2>
              <Link href="/dashboard/schedule">Lihat semua →</Link>
            </div>

            {d.upcoming.length === 0 ? (
              <div className="week-list" style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                Belum ada sesi terjadwal. Ajukan jadwal baru lewat tab Jadwal.
              </div>
            ) : (
              <div className="week-list">
                {d.upcoming.map((s) => {
                  const start = new Date(s.scheduledAt!);
                  const end = new Date(start.getTime() + durationFor(s) * 60_000);
                  const { day, mo } = fmtDay(start);
                  return (
                    <Link key={s.id} href={`/dashboard/sesi/${s.id}`} className="week-row">
                      <div className="when"><div className="day">{day}</div><div className="mo">{mo}</div></div>
                      <div className="av-grad md av-c5">{mentorInitials}</div>
                      <div className="who">
                        <div className="who-name">
                          Sesi {s.sessionNum} dengan {mentorFirst}
                          {phaseLabel(s.phase) && <span className="db-badge primary">{phaseLabel(s.phase)}</span>}
                        </div>
                        <div className="who-sub">{s.topic || "Sesi mentoring"}</div>
                      </div>
                      <span className="ttime">{fmtTime(start)} — {fmtTime(end)}</span>
                      <span className={`db-badge ${s.status === "scheduled" ? "success" : "warning"}`}>
                        ● {s.status === "scheduled" ? "Konfirmasi" : "Tentatif"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Side rail ───────────────────────────────────────────── */}
        <aside className="col-side">
          {/* Mentor card */}
          <div className="side-card mentor-card">
            <div className="mentor-blob" />
            <div className="inner">
              <span className="eyebrow">Mentor kamu</span>
              <div className="mentor-top">
                <div className="av-grad lg av-c5">{mentorInitials}</div>
                <div>
                  <div className="nm">{mentorName}</div>
                  <div className="ro">mentormu di program mentorship</div>
                </div>
              </div>
              <div className="mentor-stats">
                <div><div className="n">{String(d.total).padStart(2, "0")}</div><div className="l">Sesi total</div></div>
                <div><div className="n">{String(d.completed).padStart(2, "0")}</div><div className="l">Selesai</div></div>
                <div><div className="n">{String(Math.max(0, d.total - d.completed)).padStart(2, "0")}</div><div className="l">Tersisa</div></div>
              </div>
              <div className="mentor-actions">
                <Link href={pairHref} className="chip chip-primary grow">
                  Lihat perjalanan
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
                </Link>
                <Link href="/dashboard/schedule" className="chip chip-outline">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  Book sesi
                </Link>
              </div>
            </div>
          </div>

          {/* Kurikulum progress */}
          {d.next && (
            <div className="side-card prog-card">
              <div className="prog-head">
                <div>
                  <span className="eyebrow">Kurikulum</span>
                  <div className="m">Sesi {d.next.sessionNum}: {d.next.topic || phaseLabel(d.next.phase)}</div>
                </div>
                <span className="db-badge success">● On track</span>
              </div>
              <div className="seg">
                {Array.from({ length: d.total }).map((_, i) => (
                  <i key={i} className={i < d.completed ? "done" : i === d.nextIdx ? "now" : ""} />
                ))}
              </div>
              <p>
                Fokus sekarang: <b>{d.next.topic || phaseLabel(d.next.phase)}</b>.
                {(() => {
                  const obj = d.next!.objective ?? CURRICULUM.find((c) => c.sessionNum === d.next!.sessionNum)?.objective;
                  return obj ? ` ${obj}.` : "";
                })()}
              </p>
              <Link href={`/dashboard/sesi/${d.next.id}`} className="db-btn db-btn-outline sm">
                Lihat checklist
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
              <Link href={`/dashboard/mentee/${pairing.id}/rencana-sesi`} className="more" style={{ marginTop: 10, display: "inline-flex" }}>
                Lihat rencana sesi lengkap
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
              </Link>
            </div>
          )}

          {/* Tip card */}
          <div className="tip">
            <span className="tag">Tip dari {mentorFirst}</span>
            <h4>Tulis cerita yang jujur, bukan yang kamu kira juri mau dengar.</h4>
            <p>
              Esai terkuat biasanya soal momen kecil yang spesifik.{" "}
              <em>&ldquo;Apa satu pengalaman yang bikin kamu yakin sama jalan ini?&rdquo;</em> Mulai dari situ.
            </p>
            <Link href="/dashboard/resources" className="more">
              Buka materi
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
            </Link>
          </div>
        </aside>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="tod-preview" aria-label="Preview waktu hari">
          <span className="lbl">preview</span>
          {(["pagi", "siang", "sore", "malam"] as TodPhase[]).map((p) => (
            <button key={p} type="button" data-tod={p} className={phase === p ? "on" : ""} onClick={() => setPhaseOverride(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
