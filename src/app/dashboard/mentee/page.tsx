"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { waUrl } from "@/lib/wa-templates";

const ESCALATE_REASONS = [
  "Tidak bisa dihubungi",
  "Lewat 2 sesi berturut-turut",
  "Konflik schedule mentor",
  "Lainnya",
];

/* ─── Data shapes ─────────────────────────────────────────────────── */

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}
interface SessionRow {
  id: string;
  sessionNum: number;
  status: string;
  phase: string;
  topic?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  menteeEnergy?: number | null;
}
interface MenteeProfile {
  intendedStudyProgram?: string;
  preferredDestinations?: string;
  phoneNumber?: string;
}
interface Pairing {
  id: string;
  status: string;
  targetProgram?: string | null;
  createdAt?: string;
  mentor: User;
  mentee: User;
  sessions: SessionRow[];
  _count: { documents: number; tasks: number };
  menteeProfile?: MenteeProfile | null;
}
interface ScheduleBooking {
  id: string;
  menteeId: string;
  requestedStart: string | null;
  requestedEnd: string | null;
  status: string;
  sessionId: string | null;
  mentee?: { name: string; email: string } | null;
  session?: { sessionNum: number; topic: string; phase: string } | null;
}
interface ScheduleSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  bookings: ScheduleBooking[];
}

/** Combine a slot's `date` ("YYYY-MM-DD") with the booking's `requestedStart`
 *  ("HH:mm") into a real Date. The schedule API stores these separately. */
function bookingStart(slot: ScheduleSlot, b: ScheduleBooking): Date | null {
  if (!b.requestedStart) return null;
  const d = new Date(`${slot.date}T${b.requestedStart}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Booking statuses that count as "scheduled" (not rejected/cancelled). */
const SCHEDULED_STATUSES = new Set(["accepted", "confirmed", "pending"]);

/* ─── Helpers ─────────────────────────────────────────────────────── */

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ID_DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColorClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `av-c${(h % 6) + 1}`;
}
function fmtDayShort(d: Date): string {
  return `${ID_DAY_SHORT[d.getDay()]} ${d.getDate()} ${ID_MONTHS[d.getMonth()]}`;
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function daysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((da - db) / 86_400_000);
}

const MOOD_FACE: Record<number, string> = { 1: "😟", 2: "😐", 3: "🙂", 4: "😊", 5: "🔥" };
const MOOD_LABEL: Record<number, string> = { 1: "Cemas", 2: "Datar", 3: "Stabil", 4: "Antusias", 5: "On fire" };

type FilterKey = "all" | "active" | "paused" | "completed";
type SortKey = "attention" | "soonest" | "progress" | "alpha";

/* ─── Page ────────────────────────────────────────────────────────── */

export default function MenteePage() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const now = useMemo(() => new Date(), []);

  // Escalate modal state. `target` is null when the modal is closed.
  const [escalateTarget, setEscalateTarget] = useState<{ pairingId: string; menteeName: string } | null>(null);
  const [escalateReason, setEscalateReason] = useState<string>("Lewat 2 sesi berturut-turut");
  const [escalateContext, setEscalateContext] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [escalateResult, setEscalateResult] = useState<{ ok: true; admins: number } | { error: string } | null>(null);

  async function submitEscalate() {
    if (!escalateTarget) return;
    setEscalating(true);
    setEscalateResult(null);
    try {
      const res = await fetch("/api/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingId: escalateTarget.pairingId,
          reason: escalateReason,
          context: escalateContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEscalateResult({ error: data.error || "Gagal mengirim eskalasi." });
        return;
      }
      setEscalateResult({ ok: true, admins: data.notifiedAdmins ?? 0 });
    } catch (e) {
      console.error(e);
      setEscalateResult({ error: "Gagal mengirim eskalasi." });
    } finally {
      setEscalating(false);
    }
  }

  function closeEscalate() {
    setEscalateTarget(null);
    setEscalateReason("Lewat 2 sesi berturut-turut");
    setEscalateContext("");
    setEscalateResult(null);
    setEscalating(false);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/pairings").then((r) => r.json()).catch(() => ({ pairings: [] })),
      fetch("/api/schedule").then((r) => r.json()).catch(() => ({ slots: [] })),
    ]).then(([p, s]) => {
      setPairings(p.pairings || []);
      setSlots(s.slots || []);
    }).finally(() => setLoading(false));
  }, []);

  /* ── Derive per-mentee data (next session, attention flags, etc.) */
  const cards = useMemo(() => {
    return pairings.map((p) => {
      const completed = p.sessions.filter((s) => s.status === "completed").length;
      const total = Math.max(p.sessions.length, 10);
      const currentSession = p.sessions.find((s) => s.status !== "completed") || p.sessions[p.sessions.length - 1];
      const lastCompleted = [...p.sessions]
        .filter((s) => s.status === "completed" && s.completedAt)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
      const daysSinceLast = lastCompleted ? daysBetween(now, new Date(lastCompleted.completedAt!)) : null;

      const lastEnergy = [...p.sessions]
        .reverse()
        .find((s) => typeof s.menteeEnergy === "number" && s.menteeEnergy !== null)?.menteeEnergy ?? null;

      // Find the next booked/pending session for this mentee from the schedule.
      let nextBooking: { start: Date; sessionNum: number | null; topic: string | null; sessionId: string | null; status: string } | null = null;
      for (const slot of slots) {
        for (const b of slot.bookings || []) {
          if (b.menteeId !== p.mentee.id) continue;
          if (!SCHEDULED_STATUSES.has(b.status)) continue;
          const start = bookingStart(slot, b);
          if (!start) continue;
          if (start.getTime() < now.getTime()) continue;
          if (!nextBooking || start.getTime() < nextBooking.start.getTime()) {
            nextBooking = {
              start,
              sessionNum: b.session?.sessionNum ?? null,
              topic: b.session?.topic ?? null,
              sessionId: b.sessionId,
              status: b.status,
            };
          }
        }
      }

      const flagged =
        (lastEnergy !== null && lastEnergy <= 2) ||
        (daysSinceLast !== null && daysSinceLast >= 14) ||
        (!lastCompleted && p.sessions.length > 0 && p.status === "active");

      // Decide which flag pill(s) to show.
      const flagPills: Array<{ kind: "warn" | "bad" | "good" | "accent"; label: string }> = [];
      if (daysSinceLast !== null && daysSinceLast >= 14) {
        flagPills.push({ kind: "bad", label: `⚠ Jeda ${daysSinceLast} hari · risiko drop-off` });
      }
      if (lastEnergy !== null && lastEnergy <= 2) {
        flagPills.push({ kind: "warn", label: `Energi rendah · Sesi ${lastCompleted?.sessionNum ?? currentSession?.sessionNum ?? "?"}` });
      }
      if (p._count.documents === 0 && p.status === "active") {
        flagPills.push({ kind: "warn", label: "⚠ Belum ada dokumen" });
      }
      if (!flagPills.length && lastEnergy !== null) {
        flagPills.push({ kind: "accent", label: `Mood: ${MOOD_FACE[lastEnergy]} ${MOOD_LABEL[lastEnergy]}` });
      }
      if (!flagPills.length && completed === total) {
        flagPills.push({ kind: "good", label: "● Selesai" });
      }
      if (!flagPills.length) {
        flagPills.push({ kind: "good", label: "● On track" });
      }

      // "Baru match" — freshly created pairing where mentor hasn't gone
      // through the planner yet. Heuristic: created within last 14 days,
      // no completed sessions, no scheduled bookings. The mentor sees a
      // dedicated card variant nudging them to /rencana-sesi.
      const ageDays = p.createdAt ? daysBetween(now, new Date(p.createdAt)) : null;
      const isNewMatch =
        p.status === "active" &&
        completed === 0 &&
        !nextBooking &&
        (ageDays !== null && ageDays <= 14);

      return {
        pairing: p,
        completed,
        total,
        currentSession,
        nextBooking,
        daysSinceLast,
        lastEnergy,
        flagged,
        flagPills,
        isNewMatch,
      };
    });
  }, [pairings, slots, now]);

  /* ── Apply filter + sort. */
  const visible = useMemo(() => {
    let out = [...cards];
    if (filter === "active") out = out.filter((c) => c.pairing.status === "active");
    if (filter === "paused") out = out.filter((c) => c.pairing.status === "paused");
    if (filter === "completed") out = out.filter((c) => c.completed === c.total);

    out.sort((a, b) => {
      if (sort === "attention") {
        const af = a.flagged ? 1 : 0;
        const bf = b.flagged ? 1 : 0;
        if (bf !== af) return bf - af;
      }
      if (sort === "soonest") {
        const at = a.nextBooking?.start.getTime() ?? Infinity;
        const bt = b.nextBooking?.start.getTime() ?? Infinity;
        if (at !== bt) return at - bt;
      }
      if (sort === "progress") {
        return b.completed - a.completed;
      }
      if (sort === "alpha") {
        return a.pairing.mentee.name.localeCompare(b.pairing.mentee.name);
      }
      return a.pairing.mentee.name.localeCompare(b.pairing.mentee.name);
    });
    return out;
  }, [cards, filter, sort]);

  /* ── Stats strip. */
  const activeCount = cards.filter((c) => c.pairing.status === "active").length;
  const attentionCount = cards.filter((c) => c.flagged && c.pairing.status === "active").length;
  const weekSessionsCount = useMemo(() => {
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
    let n = 0;
    for (const slot of slots) {
      for (const b of slot.bookings || []) {
        if (!SCHEDULED_STATUSES.has(b.status)) continue;
        const start = bookingStart(slot, b);
        if (!start || start < now || start > sevenDaysOut) continue;
        n++;
      }
    }
    return n;
  }, [slots, now]);
  const completedSessions = cards.reduce((acc, c) => acc + c.completed, 0);

  /* ── "Kalender mentee minggu ini" rail items. */
  const weekRail = useMemo(() => {
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
    const out: Array<{ booking: ScheduleBooking; start: Date; menteeName: string }> = [];
    for (const slot of slots) {
      for (const b of slot.bookings || []) {
        if (!SCHEDULED_STATUSES.has(b.status)) continue;
        const start = bookingStart(slot, b);
        if (!start || start < now || start > sevenDaysOut) continue;
        out.push({ booking: b, start, menteeName: b.mentee?.name || "Mentee" });
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 5);
  }, [slots, now]);

  /* ── Pick the highest-priority at-risk mentee for the AI rec card. */
  const recommend = useMemo(() => {
    const candidate =
      cards.find((c) => c.daysSinceLast !== null && c.daysSinceLast >= 14 && c.pairing.status === "active") ||
      cards.find((c) => c.lastEnergy !== null && c.lastEnergy <= 2 && c.pairing.status === "active");
    if (!candidate) return null;
    return {
      mentee: candidate.pairing.mentee,
      phoneNumber: candidate.pairing.menteeProfile?.phoneNumber,
      jedaHari: candidate.daysSinceLast,
      reason:
        candidate.daysSinceLast !== null && candidate.daysSinceLast >= 14
          ? `Pola jeda ${candidate.daysSinceLast} hari biasanya berujung drop-off. Kirim pesan tanpa pressure — tanyakan kabar, jangan langsung jadwal.`
          : "Mood mentee turun di sesi terakhir. Pertimbangkan check-in singkat tanpa agenda berat.",
      kind: (candidate.daysSinceLast !== null && candidate.daysSinceLast >= 14 ? "reengage" : "checkin") as "reengage" | "checkin",
    };
  }, [cards]);

  if (loading) return <SkeletonDashboard />;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Mentor</div>
          <h1 className="sesi-title">
            Mentee <span className="lede">— {activeCount} aktif.</span>
          </h1>
          <p className="sesi-sub">
            Ringkasan tiap mentee: progres sesi, status dokumen, dan apa yang menunggu kamu.
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="mentee-stats-strip">
        <div className="mentee-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" />
              <circle cx="17" cy="8" r="3" /><path d="M22 20a6 6 0 0 0-5-5.91" />
            </svg>
          </div>
          <div>
            <div className="lbl">Aktif</div>
            <div className="val">{String(activeCount).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="mentee-stat tone-warn">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div>
            <div className="lbl">Butuh perhatian</div>
            <div className="val">{String(attentionCount).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="mentee-stat">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M16 3v4M8 3v4M3 9h18" />
            </svg>
          </div>
          <div>
            <div className="lbl">Sesi minggu ini</div>
            <div className="val">{String(weekSessionsCount).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="mentee-stat tone-good">
          <div className="ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="lbl">Sesi selesai</div>
            <div className="val">{String(completedSessions).padStart(2, "0")}</div>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="mentee-filter-row">
        {(
          [
            { key: "all", label: `Semua · ${cards.length}` },
            { key: "active", label: `Aktif · ${activeCount}` },
            { key: "paused", label: `Paused · ${cards.filter((c) => c.pairing.status === "paused").length}` },
            { key: "completed", label: `Selesai · ${cards.filter((c) => c.completed === c.total).length}` },
          ] as Array<{ key: FilterKey; label: string }>
        ).map((f) => (
          <button
            type="button"
            key={f.key}
            className={`db-pill ${filter === f.key ? "on" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="spacer" />
        <div className="sort-control">
          <span>Urut</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="attention">Butuh perhatian dulu</option>
            <option value="soonest">Sesi terdekat</option>
            <option value="progress">Progres terjauh</option>
            <option value="alpha">Nama A–Z</option>
          </select>
        </div>
      </div>

      {/* Main split */}
      <div className="mentee-split">
        <div className="mentee-list">
          {visible.length === 0 ? (
            <div className="mentee-card" style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
              Tidak ada mentee yang cocok dengan filter ini.
            </div>
          ) : (
            visible.map(({ pairing, completed, total, currentSession, nextBooking, flagged, flagPills, isNewMatch }) => {
              const target = pairing.menteeProfile?.intendedStudyProgram || pairing.targetProgram;
              const dest = pairing.menteeProfile?.preferredDestinations;

              // "Baru match" — dedicated CTA card pointing at the session planner.
              if (isNewMatch) {
                return (
                  <Link
                    key={pairing.id}
                    href={`/dashboard/mentee/${pairing.id}/rencana-sesi`}
                    className="mentee-card mentee-card-newmatch"
                  >
                    <div className="mentee-top">
                      <div className={`av-grad md ${avatarColorClass(pairing.mentee.name)}`}>
                        {initials(pairing.mentee.name)}
                      </div>
                      <div className="mentee-info">
                        <h3 className="mentee-name">{pairing.mentee.name}</h3>
                        <div className="mentee-meta">
                          {target && <><b>{target}</b><span className="dot" /></>}
                          {dest && <><span>{dest}</span><span className="dot" /></>}
                          <span>{pairing.mentee.email}</span>
                        </div>
                        <div className="mentee-pills">
                          <span className="db-pill static accent">⭐ Baru match</span>
                          <span className="db-pill static">Belum ada rencana sesi</span>
                        </div>
                      </div>
                    </div>

                    <div className="newmatch-callout">
                      <div className="newmatch-callout-body">
                        <strong>Susun rencana 5–15 sesi.</strong>
                        <p>
                          Mulai dari template 10 sesi Satu Tuju. Edit judul, durasi, urutan — lalu finalisasi
                          dan kirim ke {pairing.mentee.name.split(/\s+/)[0]}.
                        </p>
                      </div>
                      <span className="newmatch-cta">
                        Susun rencana sesi →
                      </span>
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={pairing.id}
                  href={`/dashboard/pairings/${pairing.id}`}
                  className={`mentee-card ${flagged ? "flagged" : ""}`}
                >
                  <div className="mentee-top">
                    <div className={`av-grad md ${avatarColorClass(pairing.mentee.name)}`}>
                      {initials(pairing.mentee.name)}
                    </div>
                    <div className="mentee-info">
                      <h3 className="mentee-name">{pairing.mentee.name}</h3>
                      <div className="mentee-meta">
                        {target && <><b>{target}</b><span className="dot" /></>}
                        {dest && <><span>{dest}</span><span className="dot" /></>}
                        <span>{pairing.mentee.email}</span>
                      </div>
                      <div className="mentee-pills">
                        {flagPills.map((p, i) => (
                          <span key={i} className={`db-pill static ${p.kind}`}>{p.label}</span>
                        ))}
                      </div>
                    </div>
                    {nextBooking && (
                      <div className="next-session">
                        <div className="when-eyebrow">Sesi berikutnya</div>
                        <div className="when">
                          {fmtDayShort(nextBooking.start).split(" ").slice(0, 1)} · {fmtTime(nextBooking.start)}
                        </div>
                        <div className="topic">
                          {nextBooking.sessionNum ? `Sesi ${nextBooking.sessionNum}` : "Sesi"}
                          {nextBooking.topic && ` · ${nextBooking.topic.slice(0, 30)}${nextBooking.topic.length > 30 ? "…" : ""}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Journey bar */}
                  <div className="journey">
                    {pairing.sessions.map((s) => {
                      const isCurrent = currentSession && s.id === currentSession.id;
                      const isDone = s.status === "completed";
                      const isRisk = isCurrent && flagged;
                      const cls = isDone ? "done" : isCurrent ? (isRisk ? "risk" : "now") : "";
                      return <span key={s.id} className={`step ${cls}`} />;
                    })}
                    {/* Pad to a minimum of 10 segments so the bar visually matches the design. */}
                    {pairing.sessions.length < 10 &&
                      Array.from({ length: 10 - pairing.sessions.length }).map((_, i) => (
                        <span key={`pad-${i}`} className="step" />
                      ))}
                  </div>
                  <div className="journey-labels">
                    <span>{completed} dari {total} sesi</span>
                    <span className={flagged ? "risk" : ""}>
                      {Math.round((completed / total) * 100)}% selesai
                      {flagged && completed > 0 ? " — perlu re-engagement" : ""}
                    </span>
                  </div>

                  <div className="mentee-actions">
                    {currentSession && (
                      <Link
                        href={`/dashboard/sesi/${currentSession.id}`}
                        className="db-btn db-btn-primary sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon name="video" size={14} />
                        Buka sesi {currentSession.sessionNum}
                      </Link>
                    )}
                    <button
                      type="button"
                      className="db-btn db-btn-outline sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const link = waUrl(
                          flagged ? "checkin" : "reminder",
                          { menteeName: pairing.mentee.name, sessionNum: currentSession?.sessionNum ?? null },
                          pairing.menteeProfile?.phoneNumber,
                        );
                        window.open(link, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Icon name="bell" size={14} />
                      Kirim pesan
                    </button>
                    <span className="spacer" />
                    <Link
                      href={`/dashboard/schedule?menteeId=${pairing.mentee.id}`}
                      className="db-btn-ghost sm"
                      onClick={(e) => e.stopPropagation()}
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      Reschedule
                    </Link>
                    <Link
                      href={`/dashboard/pairings/${pairing.id}#documents`}
                      className="db-btn-ghost sm"
                      onClick={(e) => e.stopPropagation()}
                      style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                    >
                      Lihat dokumen ({pairing._count.documents})
                    </Link>
                    {flagged && (
                      <button
                        type="button"
                        className="db-btn-ghost sm mentee-escalate-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEscalateTarget({ pairingId: pairing.id, menteeName: pairing.mentee.name });
                        }}
                        title="Minta admin turun tangan"
                      >
                        ⚠ Eskalasi
                      </button>
                    )}
                  </div>
                </Link>
              );
            })
          )}

          <button type="button" className="add-mentee">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
            </svg>
            <div style={{ marginTop: 4 }}>
              Tambah mentee baru ·{" "}
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>tim akan match-kan untuk kamu</span>
            </div>
          </button>
        </div>

        {/* Side rail */}
        <aside className="mentee-side">
          {recommend && (
            <div className="recommend">
              <span className="tag">Saran minggu ini</span>
              <h3>{recommend.mentee.name.split(/\s+/)[0]} butuh <em>nudge</em> ramah</h3>
              <p>{recommend.reason}</p>
              <a
                href={waUrl(
                  recommend.kind,
                  { menteeName: recommend.mentee.name, jedaHari: recommend.jedaHari ?? null },
                  recommend.phoneNumber,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="db-btn db-btn-primary sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                Kirim pesan via WhatsApp
                <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
                </svg>
              </a>
            </div>
          )}

          <div className="mentee-side-card">
            <h3>Kalender mentee minggu ini</h3>
            <div className="desc">Klik untuk loncat ke detail sesi.</div>
            {weekRail.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted-3)", padding: "8px 0" }}>
                Belum ada sesi terjadwal minggu ini.
              </div>
            ) : (
              weekRail.map((r) => (
                <Link
                  key={r.booking.id}
                  href={r.booking.sessionId ? `/dashboard/sesi/${r.booking.sessionId}` : "/dashboard/schedule"}
                  className="mentee-side-row"
                >
                  <span className={`av-grad sm ${avatarColorClass(r.menteeName)}`}>{initials(r.menteeName)}</span>
                  <span className="name">
                    {r.menteeName.split(/\s+/)[0]}
                    {r.booking.session?.sessionNum && ` · Sesi ${r.booking.session.sessionNum}`}
                    <span className="sub">{r.booking.session?.topic || "Sesi mentoring"}</span>
                  </span>
                  <span className="when">{fmtDayShort(r.start).split(" ")[0]} {fmtTime(r.start)}</span>
                </Link>
              ))
            )}
          </div>

          <div className="mentee-side-card">
            <h3>Lulus dari kamu</h3>
            <div className="desc">
              Mentee yang sudah menyelesaikan program. Alumni tracking akan tersedia segera.
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted-3)", padding: "8px 0" }}>
              Belum ada alumni tercatat.
            </div>
          </div>
        </aside>
      </div>

      {/* Escalate modal — opens when mentor presses "⚠ Eskalasi" on any
          flagged card. Pick a reason + optional context, fires off a
          high-priority notification to all admins. */}
      <Modal
        open={!!escalateTarget}
        onClose={closeEscalate}
        title={escalateTarget ? `Eskalasi ${escalateTarget.menteeName}` : ""}
        description="Admin akan kontak langsung mentee dalam 24 jam. Kamu tetap mentor — ini cuma backup channel."
        size="md"
        variant="danger"
        actions={
          escalateResult && "ok" in escalateResult ? (
            <button type="button" className="db-btn db-btn-primary" onClick={closeEscalate}>
              Tutup
            </button>
          ) : (
            <>
              <button type="button" className="db-btn db-btn-outline" onClick={closeEscalate} disabled={escalating}>
                Batal
              </button>
              <button
                type="button"
                className="db-btn db-btn-primary"
                onClick={submitEscalate}
                disabled={escalating || !escalateTarget}
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {escalating ? "Mengirim…" : "Kirim eskalasi →"}
              </button>
            </>
          )
        }
      >
        {escalateResult && "ok" in escalateResult ? (
          <div style={{ padding: "10px 0" }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--success)" }}>
              ✓ Eskalasi terkirim ke {escalateResult.admins} admin. Mereka akan tindak lanjut dalam 24 jam.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Alasan
              </legend>
              {ESCALATE_REASONS.map((r) => (
                <label
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: escalateReason === r ? "var(--primary-50)" : "var(--surface)",
                    border: `1px solid ${escalateReason === r ? "var(--primary-200)" : "var(--border)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="radio"
                    name="escalate-reason"
                    value={r}
                    checked={escalateReason === r}
                    onChange={() => setEscalateReason(r)}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </fieldset>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Konteks tambahan (opsional)
              </span>
              <textarea
                value={escalateContext}
                onChange={(e) => setEscalateContext(e.target.value)}
                placeholder="Apa yang sudah kamu coba? Apa yang admin perlu tau?"
                rows={3}
                maxLength={500}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  resize: "vertical",
                  background: "var(--surface)",
                  color: "var(--foreground)",
                }}
              />
            </label>
            {escalateResult && "error" in escalateResult && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>
                {escalateResult.error}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
