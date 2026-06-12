"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { getCached, revalidate } from "@/lib/swr-lite";
import {
  currentWibHour,
  phaseFromHour,
  todConfig,
  TodIcon,
  type TodPhase,
} from "@/lib/time-of-day";
import { waUrl, type WaTemplateKind } from "@/lib/wa-templates";

/* ─── Data shapes ──────────────────────────────────────────────────── */

interface Mentee {
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
  menteeEnergy?: number | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
}
interface Pairing {
  id: string;
  status: string;
  targetProgram?: string | null;
  mentee: Mentee;
  sessions: SessionRow[];
  _count: { documents: number; tasks: number };
  menteeProfile?: { intendedStudyProgram?: string; preferredDestinations?: string; phoneNumber?: string } | null;
}

interface ScheduleBooking {
  id: string;
  menteeId: string;
  requestedStart: string | null;
  requestedEnd: string | null;
  status: string;
  googleMeetLink: string | null;
  mentee?: { name: string; email: string } | null;
  session?: { sessionNum: number; topic: string; phase: string } | null;
}
interface ScheduleSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  bookings: ScheduleBooking[];
}

/** Bookings store `requestedStart` as "HH:mm" relative to the slot's `date`.
 *  Combine them into a real Date so we can compare against now / sort upcoming. */
function bookingDate(slot: ScheduleSlot, b: ScheduleBooking, which: "start" | "end"): Date | null {
  const time = which === "start" ? b.requestedStart : b.requestedEnd;
  if (!time) return null;
  const d = new Date(`${slot.date}T${time}`);
  return isNaN(d.getTime()) ? null : d;
}

/** Booking statuses that mean a session is actually on the calendar. */
const SCHEDULED_STATUSES = new Set(["accepted", "confirmed", "pending"]);

interface MentorProfile {
  fullName?: string | null;
  city?: string | null;
  undergradMajor?: string | null;
  undergradUniversity?: string | null;
  postgradMajor?: string | null;
  postgradUniversity?: string | null;
  fundingScheme?: string | null;
  currentField?: string | null;
  mentorStyle?: string | null;
  workStyle?: string | null;
  communicationStyle?: string | null;
  primaryRoles?: string[] | null;
  phoneNumber?: string | null; // WhatsApp — mentee contacts the mentor here
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

const REQUIRED_PROFILE_FIELDS: Array<keyof MentorProfile> = [
  "fullName", "city", "undergradMajor", "undergradUniversity",
  "postgradMajor", "postgradUniversity", "fundingScheme", "currentField",
  "mentorStyle", "workStyle", "communicationStyle", "primaryRoles",
];

function profileCompleteness(profile: MentorProfile | null) {
  if (!profile) return { complete: false, filled: 0, total: REQUIRED_PROFILE_FIELDS.length };
  let filled = 0;
  for (const f of REQUIRED_PROFILE_FIELDS) {
    const v = profile[f];
    if (Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && v !== "")) filled++;
  }
  return { complete: filled === REQUIRED_PROFILE_FIELDS.length, filled, total: REQUIRED_PROFILE_FIELDS.length };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable color class per mentee, so the same person always renders with the
 *  same gradient across Beranda sections. Hash on name to keep deterministic. */
function avatarColorClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `av-c${(h % 6) + 1}`;
}

/** "12 Mei" → { day: "12", mo: "Mei" }. Uses 3-letter Indonesian month + day name. */
const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ID_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function fmtDay(d: Date): { day: string; mo: string } {
  return { day: String(d.getDate()), mo: ID_DAYS[d.getDay()] };
}
function fmtDateEyebrow(d: Date): string {
  // "Sabtu, 9 Mei 2026"
  const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getDay()];
  return `${dayName}, ${d.getDate()} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const t = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${t(start)} — ${t(end)}`;
}
function fmtCountdown(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return "sudah dimulai";
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}j ${m}m`;
}
function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysFromNow(d: Date, now: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/* ─── Beranda component ───────────────────────────────────────────── */

export default function MentorDashboard() {
  // Seed from the shared cache so revisiting Beranda renders instantly; a
  // background revalidate (below) keeps it fresh. (Profile is NOT cached.)
  const cachedPairings = getCached<{ pairings: Pairing[] }>("/api/pairings");
  const cachedSchedule = getCached<{ slots: ScheduleSlot[] }>("/api/schedule");
  const [pairings, setPairings] = useState<Pairing[]>(cachedPairings?.pairings ?? []);
  const [slots, setSlots] = useState<ScheduleSlot[]>(cachedSchedule?.slots ?? []);
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  // The profile is fetched fresh on every mount (never cached), so `profile`
  // is null until that fetch lands. Track that explicitly — `loading` is
  // seeded from the *pairings* cache and can be false while the profile is
  // still unknown, which would otherwise flash the "complete your profile"
  // banner (computed from a null profile = 0/12) before hiding it.
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(cachedPairings === undefined);

  // One-time WhatsApp backfill for mentors who onboarded before the number was
  // collected. Shows only when the profile is loaded and has no phoneNumber.
  const [waInput, setWaInput] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [waErr, setWaErr] = useState("");
  async function saveWhatsapp() {
    const num = waInput.trim();
    if (num.replace(/\D/g, "").length < 8) { setWaErr("Nomor WhatsApp belum valid."); return; }
    setWaSaving(true);
    setWaErr("");
    try {
      const res = await fetch("/api/mentor-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: num }),
      });
      if (!res.ok) throw new Error("save failed");
      setProfile((p) => (p ? { ...p, phoneNumber: num } : p));
    } catch {
      setWaErr("Gagal menyimpan. Coba lagi.");
    } finally {
      setWaSaving(false);
    }
  }

  // Time-of-day phase (override-able via the dev preview chip).
  const [phaseOverride, setPhaseOverride] = useState<TodPhase | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Per-pairing snooze. Hides an attention item for 24 h. Persisted to
  // localStorage so it survives reloads. Map of pairingId → unix-ms-expiry.
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("attention-snoozed");
      if (raw) setSnoozed(JSON.parse(raw));
    } catch {
      /* localStorage unavailable — proceed without snooze state */
    }
  }, []);
  function snoozePairing(pairingId: string) {
    const next = { ...snoozed, [pairingId]: Date.now() + 24 * 60 * 60_000 };
    setSnoozed(next);
    try {
      localStorage.setItem("attention-snoozed", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // Tick the clock every minute so the countdown stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Always revalidate in the background (cached or not). Profile stays fresh.
    Promise.all([
      revalidate<{ pairings: Pairing[] }>("/api/pairings").catch(() => ({ pairings: [] })),
      revalidate<{ slots: ScheduleSlot[] }>("/api/schedule").catch(() => ({ slots: [] })),
      fetch("/api/mentor-profile").then((r) => r.json()).catch(() => ({ profile: null })),
    ]).then(([p, s, m]) => {
      setPairings(p?.pairings || []);
      setSlots(s?.slots || []);
      setProfile(m.profile || null);
    }).finally(() => {
      setProfileLoaded(true);
      setLoading(false);
    });
  }, []);

  const phase = phaseOverride ?? phaseFromHour(currentWibHour(now));
  const tod = todConfig(phase);
  const profileStatus = profileCompleteness(profile);

  /* ── Derived data ─────────────────────────────────────────────── */

  // Flatten all confirmed/pending bookings across all slots into a single
  // "scheduled session" list, keeping the metadata Beranda needs (time, mentee
  // name, session topic, status). We filter to bookings whose mentor is the
  // current user — true by construction since /api/schedule already scoped it.
  const upcoming = useMemo(() => {
    const out: Array<{
      bookingId: string;
      sessionId: string | null;
      menteeId: string;
      menteeName: string;
      start: Date;
      end: Date;
      status: string;
      sessionNum: number | null;
      topic: string | null;
      phase: string | null;
      meetLink: string | null;
    }> = [];
    for (const slot of slots) {
      for (const b of slot.bookings || []) {
        if (!SCHEDULED_STATUSES.has(b.status)) continue;
        const start = bookingDate(slot, b, "start");
        const end = bookingDate(slot, b, "end");
        if (!start || !end) continue;
        out.push({
          bookingId: b.id,
          sessionId: (b as ScheduleBooking & { sessionId?: string }).sessionId ?? null,
          menteeId: b.menteeId,
          menteeName: b.mentee?.name || "Mentee",
          start,
          end,
          status: b.status,
          sessionNum: b.session?.sessionNum ?? null,
          topic: b.session?.topic ?? null,
          phase: b.session?.phase ?? null,
          meetLink: b.googleMeetLink,
        });
      }
    }
    return out
      .filter((b) => b.end.getTime() >= now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [slots, now]);

  const todaySession = upcoming.find((b) => isSameLocalDay(b.start, now)) || null;

  const weekSessions = useMemo(() => {
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
    return upcoming
      .filter((b) => b.start <= sevenDaysOut)
      .filter((b) => b !== todaySession)
      .slice(0, 6);
  }, [upcoming, now, todaySession]);

  // Stats
  const activeMentees = pairings.filter((p) => p.status === "active").length;
  const sessionsThisSemester = pairings.reduce(
    (acc, p) => acc + p.sessions.filter((s) => s.status === "completed").length,
    0,
  );
  const availableHours = useMemo(() => {
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
    let mins = 0;
    let bookedCount = 0;
    let totalCount = 0;
    for (const slot of slots) {
      const slotDate = new Date(`${slot.date}T${slot.startTime}`);
      if (slotDate < now || slotDate > sevenDaysOut) continue;
      totalCount++;
      const hasBooking = (slot.bookings || []).some((b) => SCHEDULED_STATUSES.has(b.status));
      if (hasBooking) {
        bookedCount++;
        continue;
      }
      // Slot duration in minutes
      const [sh, sm] = slot.startTime.split(":").map(Number);
      const [eh, em] = slot.endTime.split(":").map(Number);
      mins += (eh * 60 + em) - (sh * 60 + sm);
    }
    return { hours: Math.round(mins / 60), bookedCount, totalCount };
  }, [slots, now]);

  // Mentees needing attention: low energy recent session, or 14+ days since
  // last completion. Each item carries the WA template kind that best fits
  // the reason — Beranda renders one targeted CTA per item instead of a
  // generic "Buka pairing".
  const attention = useMemo(() => {
    const items: Array<{
      pairing: Pairing;
      reason: string;
      daysAgo: number;
      waKind: WaTemplateKind;
    }> = [];
    for (const p of pairings) {
      if (p.status !== "active") continue;
      if (snoozed[p.id] && snoozed[p.id] > Date.now()) continue;
      const completed = p.sessions.filter((s) => s.status === "completed" && s.completedAt);
      const last = completed.sort(
        (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
      )[0];
      const lowEnergy = [...p.sessions].reverse().find((s) => typeof s.menteeEnergy === "number" && (s.menteeEnergy ?? 5) <= 2);
      if (lowEnergy) {
        items.push({
          pairing: p,
          reason: `Energi rendah di sesi ${lowEnergy.sessionNum}. Pertimbangkan check-in singkat.`,
          daysAgo: 0,
          waKind: "checkin",
        });
        continue;
      }
      if (last) {
        const days = daysFromNow(now, new Date(last.completedAt!));
        if (days >= 14) {
          items.push({
            pairing: p,
            reason: `Jeda ${days} hari sejak sesi terakhir — risiko drop-off.`,
            daysAgo: days,
            waKind: "reengage",
          });
        }
      } else if (p.sessions.length > 0) {
        items.push({
          pairing: p,
          reason: "Belum ada sesi tercatat. Atur sesi pertama segera.",
          daysAgo: 0,
          waKind: "reminder",
        });
      }
    }
    return items.slice(0, 3);
  }, [pairings, now, snoozed]);

  /* ── Render ────────────────────────────────────────────────────── */

  if (loading) return <SkeletonDashboard />;

  const eyebrow = fmtDateEyebrow(now);
  const greetSubBits = [
    activeMentees > 0 ? <><b>{activeMentees}</b> mentee aktif</> : null,
    weekSessions.length + (todaySession ? 1 : 0) > 0 ? <><b>{weekSessions.length + (todaySession ? 1 : 0)} sesi</b> minggu ini</> : null,
    attention.length > 0 ? <><b>{attention.length} mentee</b> butuh perhatian</> : null,
  ].filter(Boolean) as React.ReactNode[];

  return (
    <>
      {profileLoaded && !profileStatus.complete && (
        <Link
          href="/dashboard/mentor-profile"
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition mb-8"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Icon name="alert" size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Lengkapi profil mentor sebelum di-pair</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Profil kamu {profileStatus.filled}/{profileStatus.total} kolom terisi. Admin pakai ini buat cocokin kamu sama mentee yang tepat.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${(profileStatus.filled / profileStatus.total) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">Lengkapi sekarang →</span>
            </div>
          </div>
        </Link>
      )}

      {/* WhatsApp backfill — only when profile loaded and number missing. */}
      {profile && !profile.phoneNumber && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 mb-8">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Icon name="chat" size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Tambahkan nomor WhatsApp kamu</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Mentee menghubungi kamu lewat WhatsApp ini. Tanpa nomor, tombol &ldquo;Tanya mentor&rdquo; jatuh ke email.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <input
                type="tel"
                inputMode="tel"
                value={waInput}
                onChange={(e) => { setWaInput(e.target.value); setWaErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") saveWhatsapp(); }}
                placeholder="08123456789"
                className="input-field flex-1 text-sm max-w-[220px]"
                disabled={waSaving}
              />
              <button
                type="button"
                onClick={saveWhatsapp}
                disabled={waSaving || !waInput.trim()}
                className="db-btn db-btn-primary sm whitespace-nowrap"
              >
                {waSaving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
            {waErr && <p className="text-xs text-red-500 mt-1.5">{waErr}</p>}
          </div>
        </div>
      )}

      <div className="home-grid">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="col-main">
          <div className="greet-block">
            <span className="eyebrow primary">{eyebrow}</span>
            <h1 className="greet">
              <span className="lede">{tod.greet}, {(profile?.fullName || "kamu").split(/\s+/)[0]}.</span>
              <span className={`tod ${tod.toneClass}`}><TodIcon phase={phase} /></span>
              <br />
              {todaySession
                ? `${1 + weekSessions.length} sesi minggu ini${todaySession ? `, ${todaySession.menteeName.split(/\s+/)[0]} dimulai hari ini.` : "."}`
                : weekSessions.length > 0
                  ? `${weekSessions.length} sesi terjadwal minggu ini.`
                  : "Belum ada sesi terjadwal. Atur slot pertama kamu di Jadwal."}
            </h1>
            {greetSubBits.length > 0 && (
              <div className="greet-sub">
                {greetSubBits.flatMap((bit, i) => i === 0 ? [<span key={`b-${i}`}>{bit}</span>] : [<span key={`d-${i}`} className="dot" />, <span key={`b-${i}`}>{bit}</span>])}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="stats">
            <div className="stat">
              <div className="lbl">Mentee aktif</div>
              <div className="val">{activeMentees}</div>
              <div className="delta">
                {pairings.length - activeMentees > 0
                  ? `${pairings.length - activeMentees} pairing lain non-aktif`
                  : "Semua pairing aktif"}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">Jam tersedia</div>
              <div className="val">{availableHours.hours}<span className="unit">jam</span></div>
              <div className="delta">
                {availableHours.totalCount > 0
                  ? `${availableHours.bookedCount} dari ${availableHours.totalCount} slot sudah dibooking`
                  : "Belum ada slot · 7 hari ke depan"}
              </div>
            </div>
            <div className="stat">
              <div className="lbl">Sesi semester ini</div>
              <div className="val">{sessionsThisSemester}</div>
              <div className="delta">{`target: ${activeMentees * 10}`}</div>
            </div>
          </div>

          {/* Hari ini */}
          <section className="section">
            <div className="section-head">
              <h2>Hari ini</h2>
              <span className="meta">{todaySession ? "1 sesi terjadwal" : "Tidak ada sesi"}</span>
            </div>

            {todaySession ? (
              <div className="today">
                <div className="today-blob" />
                <div className="today-content">
                  <div className="today-head">
                    <span className="badge-pulse">
                      <span className="pulse-dot" />
                      Hari ini{todaySession.sessionNum ? ` · Sesi ${todaySession.sessionNum}` : ""}
                    </span>
                    <span className="today-when">
                      dimulai dalam <b>{fmtCountdown(todaySession.start, now)}</b>
                      {" · "}
                      {todaySession.start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })} WIB
                      {todaySession.meetLink ? " · Google Meet" : ""}
                    </span>
                  </div>

                  <div className="today-row">
                    <div className={`av-grad lg ${avatarColorClass(todaySession.menteeName)}`}>
                      {initials(todaySession.menteeName)}
                    </div>
                    <div>
                      {todaySession.phase && <span className="eyebrow primary">{todaySession.phase}</span>}
                      <h3>{todaySession.topic || "Sesi mentoring"}</h3>
                      <p className="who">Bersama <b>{todaySession.menteeName}</b></p>
                    </div>
                    <div className="actions">
                      {todaySession.sessionId ? (
                        <Link href={`/dashboard/sesi/${todaySession.sessionId}`} className="db-btn db-btn-outline sm">Lihat persiapan</Link>
                      ) : (
                        <Link href="/dashboard/schedule" className="db-btn db-btn-outline sm">Lihat persiapan</Link>
                      )}
                      {todaySession.meetLink ? (
                        <a href={todaySession.meetLink} target="_blank" rel="noopener noreferrer" className="db-btn db-btn-primary">
                          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m23 7-7 5 7 5V7Z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                          Mulai sesi
                        </a>
                      ) : (
                        <Link href="/dashboard/schedule" className="db-btn db-btn-primary">Atur Meet link</Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="today">
                <div className="today-blob" />
                <div className="today-content">
                  <div className="today-head">
                    <span className="eyebrow primary">Tenang dulu</span>
                  </div>
                  <div className="today-row">
                    <div className="av-grad lg av-c2">✓</div>
                    <div>
                      <h3>Tidak ada sesi hari ini</h3>
                      <p className="who">Gunakan waktu ini untuk review catatan minggu lalu atau atur slot baru.</p>
                    </div>
                    <div className="actions">
                      <Link href="/dashboard/schedule" className="db-btn db-btn-outline sm">Atur slot</Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Minggu ini */}
          <section className="section">
            <div className="section-head">
              <h2>Minggu ini</h2>
              <Link href="/dashboard/schedule">Lihat semua →</Link>
            </div>

            {weekSessions.length === 0 ? (
              <div className="week-list" style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                Belum ada sesi terjadwal dalam 7 hari ke depan.
              </div>
            ) : (
              <div className="week-list">
                {weekSessions.map((s) => {
                  const { day, mo } = fmtDay(s.start);
                  const sesiHref = s.sessionId ? `/dashboard/sesi/${s.sessionId}` : "/dashboard/schedule";
                  return (
                    <Link key={s.bookingId} href={sesiHref} className="week-row">
                      <div className="when">
                        <div className="day">{day}</div>
                        <div className="mo">{mo}</div>
                      </div>
                      <div className={`av-grad md ${avatarColorClass(s.menteeName)}`}>{initials(s.menteeName)}</div>
                      <div className="who">
                        <div className="who-name">
                          {s.menteeName}
                          {s.sessionNum && <span className="db-badge primary">Sesi {s.sessionNum}</span>}
                        </div>
                        <div className="who-sub">{s.topic || "Sesi mentoring"}</div>
                      </div>
                      <span className="ttime">{fmtTimeRange(s.start.toISOString(), s.end.toISOString())}</span>
                      <span className={`db-badge ${s.status === "accepted" || s.status === "confirmed" ? "success" : "warning"}`}>
                        ● {s.status === "accepted" || s.status === "confirmed" ? "Konfirmasi" : "Pending"}
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
          <div className="side-card attention">
            <div className="side-head">
              <h3>Butuh perhatian</h3>
              <span className="side-count">{String(attention.length).padStart(2, "0")}</span>
            </div>

            {attention.length === 0 ? (
              <div className="att-item">
                <div className="what">Semua mentee on-track. Lanjutkan kerja bagusnya — pantau lagi besok.</div>
              </div>
            ) : (
              attention.map(({ pairing, reason, daysAgo, waKind }) => {
                const waLabel =
                  waKind === "reminder" ? "Kirim pengingat"
                    : waKind === "reengage" ? "Hubungi via WA"
                    : "Check-in";
                const phone = pairing.menteeProfile?.phoneNumber;
                const link = waUrl(waKind, {
                  menteeName: pairing.mentee.name,
                  mentorName: profile?.fullName || undefined,
                  jedaHari: daysAgo,
                }, phone);
                return (
                  <div key={pairing.id} className="att-item">
                    <div className="row-who">
                      <span className={`av-grad xs ${avatarColorClass(pairing.mentee.name)}`}>
                        {initials(pairing.mentee.name)}
                      </span>
                      <span className="name">{pairing.mentee.name}</span>
                      <span className="ago">{daysAgo > 0 ? `${daysAgo}h` : "—"}</span>
                    </div>
                    <div className="what">{reason}</div>
                    <div className="actions">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chip chip-primary"
                      >
                        {waLabel}
                      </a>
                      <button
                        type="button"
                        className="chip chip-ghost"
                        onClick={() => snoozePairing(pairing.id)}
                        title="Sembunyikan selama 24 jam"
                      >
                        Tunda
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="tip">
            <span className="tag">Tip mentor · {ID_DAYS[now.getDay()]}</span>
            <h4>Mulai sesi dengan satu pertanyaan terbuka.</h4>
            <p>
              10 menit pertama paling produktif kalau mentee yang banyak bicara. Coba:{" "}
              <em>&ldquo;Sejak kita ngobrol terakhir, ada hal yang berubah di kepala kamu soal jurusan?&rdquo;</em>
            </p>
            <Link href="/dashboard/resources" className="more">
              Buka panduan sesi
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </aside>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="tod-preview" aria-label="Preview waktu hari">
          <span className="lbl">preview</span>
          {(["pagi", "siang", "sore", "malam"] as TodPhase[]).map((p) => (
            <button
              key={p}
              type="button"
              data-tod={p}
              className={phase === p ? "on" : ""}
              onClick={() => setPhaseOverride(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
