/** Sesi (3-phase) — Phase D.1 of the v5 redesign.
 *
 *  A single session moves through three lifecycle panels:
 *    1. Sebelum sesi  — countdown, Meet link, prep checklist, agenda preview.
 *    2. Setelah sesi  — the existing laporan form, with an AI assist box.
 *    3. Mentee POV    — read-only render of what the mentee will see, with
 *                       "Setuju & kirim" to finalise.
 *
 *  Lifecycle is tracked with four Session timestamps:
 *    prepCompletedAt    → set when mentor clicks "▶ Mulai sesi"
 *    mentorPreviewAt    → set when mentor first opens the Mentee POV tab
 *    mentorSubmittedAt  → set when mentor presses "Setuju & kirim"
 *    menteeViewedAt     → set when the mentee opens the report
 *
 *  Mentee role sees a stripped variant: only the Mentee POV phase, read-only.
 */

"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import type { PrepItem } from "@/app/api/sessions/[id]/prep/route";

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
  mentorRating?: number | null;
  menteeEnergy?: number | null;
  keyOutput?: string | null;
  obstacles?: string | null;
  summaryNotes?: string | null;
  menteeFeedback?: string | null;
  prepCompletedAt?: string | null;
  mentorPreviewAt?: string | null;
  mentorSubmittedAt?: string | null;
  menteeViewedAt?: string | null;
}

interface Pairing {
  id: string;
  targetProgram?: string | null;
  mentor: User;
  mentee: User;
  sessions: SessionRow[];
  menteeProfile?: { intendedStudyProgram?: string; preferredDestinations?: string } | null;
}

type SavingState = "idle" | "saving" | "saved" | "error";
type Phase = "sebelum" | "setelah" | "mentee";

/* ─── Helpers ─────────────────────────────────────────────────────── */

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function fmtDayShort(d: Date): string {
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]}`;
}
function fmtAgo(seconds: number): string {
  if (seconds < 5) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
}

/** Countdown / since label for the Sebelum-sesi hero. */
function fmtCountdown(targetMs: number, nowMs: number): { label: string; tone: "future" | "soon" | "past" } {
  const diff = targetMs - nowMs;
  const absMin = Math.floor(Math.abs(diff) / 60_000);
  if (diff < 0) {
    if (absMin < 60) return { label: `dimulai ${absMin} mnt lalu`, tone: "past" };
    const h = Math.floor(absMin / 60);
    return { label: `dimulai ${h} jam lalu`, tone: "past" };
  }
  if (absMin < 60) return { label: `mulai dalam ${absMin} mnt`, tone: "soon" };
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  if (h < 24) return { label: `mulai dalam ${h} jam ${m} mnt`, tone: "future" };
  const d = Math.floor(h / 24);
  return { label: `mulai dalam ${d} hari`, tone: "future" };
}

const MOODS: Array<{ value: number; face: string; label: string }> = [
  { value: 1, face: "😟", label: "Cemas" },
  { value: 2, face: "😐", label: "Datar" },
  { value: 3, face: "🙂", label: "Stabil" },
  { value: 4, face: "😊", label: "Antusias" },
  { value: 5, face: "🔥", label: "On fire" },
];

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  planning: "Planning",
  writing: "Writing",
  execution: "Execution",
  closing: "Closing",
};

/** Auto-generated agenda based on the curriculum phase. */
const AGENDA_BY_PHASE: Record<string, Array<{ slot: string; topic: string }>> = {
  discovery: [
    { slot: "0–10 mnt", topic: "Check-in + recap janji sesi lalu" },
    { slot: "10–35 mnt", topic: "Eksplorasi minat, motivasi, gaya belajar" },
    { slot: "35–50 mnt", topic: "Mapping kandidat jurusan + negara" },
    { slot: "50–60 mnt", topic: "Action items + janji untuk sesi berikutnya" },
  ],
  planning: [
    { slot: "0–10 mnt", topic: "Check-in + review action items lalu" },
    { slot: "10–40 mnt", topic: "Susun strategi aplikasi (timeline + dokumen)" },
    { slot: "40–55 mnt", topic: "Identifikasi blocker + prioritas minggu depan" },
    { slot: "55–60 mnt", topic: "Janji + langkah berikutnya" },
  ],
  writing: [
    { slot: "0–10 mnt", topic: "Review draft yang sudah dikerjakan" },
    { slot: "10–45 mnt", topic: "Feedback storytelling + struktur essay" },
    { slot: "45–55 mnt", topic: "Revisi target untuk minggu depan" },
    { slot: "55–60 mnt", topic: "Janji submit draft revisi" },
  ],
  execution: [
    { slot: "0–10 mnt", topic: "Status submission + dokumen pending" },
    { slot: "10–40 mnt", topic: "Resolusi blocker konkret (LoR, transkrip, dst)" },
    { slot: "40–55 mnt", topic: "Persiapan interview / scholarship round" },
    { slot: "55–60 mnt", topic: "Komitmen aksi minggu ini" },
  ],
  closing: [
    { slot: "0–15 mnt", topic: "Review semua perjalanan + capaian" },
    { slot: "15–40 mnt", topic: "Decision matrix + final pick" },
    { slot: "40–55 mnt", topic: "Persiapan keberangkatan / next chapter" },
    { slot: "55–60 mnt", topic: "Closing reflection + alumni handoff" },
  ],
};

interface DraftFields {
  topic: string;
  summaryNotes: string;
  obstacles: string;
  menteeEnergy: number | null;
  keyOutput: string;
}

function fromSession(s: SessionRow): DraftFields {
  return {
    topic: s.topic || "",
    summaryNotes: s.summaryNotes || "",
    obstacles: s.obstacles || "",
    menteeEnergy: s.menteeEnergy ?? null,
    keyOutput: s.keyOutput || "",
  };
}

/** Convert the Postgres timestamp (which Supabase returns as a naive
 *  "YYYY-MM-DD HH:mm:ss" string) into a real Date in UTC. */
function parseTs(value?: string | null): Date | null {
  if (!value) return null;
  const s = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(s.endsWith("Z") ? s : s + "Z");
}

/* ─── Page ────────────────────────────────────────────────────────── */

export default function SesiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `draftEdits` is null until the user actually edits — until then we mirror
  // the session row. This avoids a setState-in-effect cascade on mount.
  const [draftEdits, setDraft] = useState<DraftFields | null>(null);
  const [saving, setSaving] = useState<SavingState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  // `phaseOverride` is null until the user clicks a tab; before then we derive
  // the initial phase from server-side timestamps (computed during render).
  const [phaseOverride, setActivePhase] = useState<Phase | null>(null);
  const [prep, setPrep] = useState<PrepItem[] | null>(null);
  const [prepLoading, setPrepLoading] = useState(true);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI assist state (Phase D.2). `aiMode` opens the input drawer; `aiBusy` blocks
  // the buttons while Gemini works; `aiError` surfaces backend errors inline.
  const [aiMode, setAiMode] = useState<"text" | "drive" | "file" | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<null | { topic: string; summary: string; obstacles: string; mentorNotes: string; menteeEnergy: number | null }>(null);
  const aiFileRef = useRef<HTMLInputElement | null>(null);

  // Mulai sesi (Phase D.3) — set by GET /start on mount + updated when the
  // user presses the button. Used to show the real Meet link in the hero.
  const [meetLinkOverride, setMeetLinkOverride] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Tick once every 30s so the countdown + "tersimpan otomatis" labels stay fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Load pairings + current user.
  useEffect(() => {
    Promise.all([
      fetch("/api/pairings").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()).catch(() => null),
    ])
      .then(([pData, meData]) => {
        setPairings(pData.pairings || []);
        if (meData?.user) setMe({ id: meData.user.id ?? meData.user.userId, role: meData.user.role });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Load existing Meet link (if any) from the start endpoint.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${id}/start`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.meetLink) setMeetLinkOverride(data.meetLink);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load prep checklist.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${id}/prep`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) {
          setPrep(data.items as PrepItem[]);
          setPrepLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[sesi] prep fetch failed", err);
        if (!cancelled) {
          setPrep([]);
          setPrepLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Find the session and its parent pairing. Inline (React Compiler will
  // auto-memoize) — avoids a useMemo wrapper the compiler can't preserve.
  let found: { pairing: Pairing; session: SessionRow } | null = null;
  for (const p of pairings) {
    const s = p.sessions.find((x) => x.id === id);
    if (s) {
      found = { pairing: p, session: s };
      break;
    }
  }

  // Effective draft + active phase — derived during render so we don't have
  // to setState in an effect on mount.
  const effectiveDraft: DraftFields | null = draftEdits ?? (found ? fromSession(found.session) : null);
  const effectivePhase: Phase | null = (() => {
    if (phaseOverride !== null) return phaseOverride;
    if (!found || !me) return null;
    const s = found.session;
    if (me.id === found.pairing.mentee.id) return "mentee";
    if (s.mentorSubmittedAt) return "mentee";
    if (s.prepCompletedAt || s.status !== "upcoming") return "setelah";
    return "sebelum";
  })();

  // Stamp menteeViewedAt the first time the mentee opens a submitted report,
  // so the mentor can see "dilihat mentee" in the POV footer.
  const viewedStamped = useRef(false);
  useEffect(() => {
    if (viewedStamped.current) return;
    if (!found || !me) return;
    const s = found.session;
    if (me.id !== found.pairing.mentee.id) return;
    if (!s.mentorSubmittedAt || s.menteeViewedAt) return;
    viewedStamped.current = true;
    fetch(`/api/pairings/${found.pairing.id}/sessions/${s.sessionNum}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ menteeViewedAt: true }),
    }).catch((err) => console.warn("[sesi] menteeViewedAt stamp failed", err));
  }, [found, me]);

  // PATCH wrapper — used for both draft auto-save and lifecycle stamps.
  const patchSession = useCallback(
    async (body: Record<string, unknown>) => {
      if (!found) return null;
      const res = await fetch(
        `/api/pairings/${found.pairing.id}/sessions/${found.session.sessionNum}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [found],
  );

  // Debounced auto-save for the laporan form.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function queueSave(next: DraftFields) {
    if (!found) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        await patchSession({
          topic: next.topic,
          summaryNotes: next.summaryNotes,
          obstacles: next.obstacles,
          menteeEnergy: next.menteeEnergy,
          keyOutput: next.keyOutput,
        });
        setSaving("saved");
        setLastSavedAt(new Date());
      } catch (e) {
        setSaving("error");
        console.error("Session auto-save failed", e);
      }
    }, 1200);
  }

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    // Seed from the server-derived view the first time the user types.
    const base: DraftFields | null = draftEdits ?? (found ? fromSession(found.session) : null);
    if (!base) return;
    const next = { ...base, [key]: value };
    setDraft(next);
    queueSave(next);
  }

  // Persist a single prep checklist toggle.
  function togglePrep(itemId: string) {
    if (!prep) return;
    const next = prep.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    setPrep(next);
    fetch(`/api/sessions/${id}/prep`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: next }),
    }).catch((err) => console.warn("[sesi] prep save failed", err));
  }

  // "▶ Mulai sesi" — call /start, which:
  //   1. creates a Google Calendar event with a Meet link on the mentor's
  //      personal calendar (or reuses one if the booking already has it),
  //   2. saves the meet URL on the ScheduleBooking,
  //   3. stamps prepCompletedAt + flips status to in_progress.
  //
  // On 412 "needsConnect", redirect the mentor to /api/auth/google?mode=connect
  // to grant the calendar.events scope.
  async function handleStartSession() {
    if (!found || startBusy) return;
    setStartBusy(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (res.status === 412 && data.needsConnect && data.connectUrl) {
        // Redirect to the OAuth flow. After consent, Google sends user back
        // to the Sesi page and they can press "Mulai sesi" again.
        window.location.href = data.connectUrl;
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Optimistically reflect the new stamp locally.
      setPairings((prev) =>
        prev.map((p) =>
          p.id !== found.pairing.id
            ? p
            : { ...p, sessions: p.sessions.map((s) => (s.id === id ? { ...s, prepCompletedAt: new Date().toISOString(), status: "in_progress" } : s)) },
        ),
      );
      setMeetLinkOverride(data.meetLink);
      setActivePhase("setelah");

      // Pop the Meet open in a new tab so the mentor doesn't have to hunt.
      if (data.meetLink) window.open(data.meetLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    } finally {
      setStartBusy(false);
    }
  }

  // Switching into Mentee POV stamps mentorPreviewAt the first time.
  async function gotoPhase(phase: Phase) {
    setActivePhase(phase);
    if (phase === "mentee" && found && !found.session.mentorPreviewAt) {
      try {
        await patchSession({ mentorPreviewAt: true });
        setPairings((prev) =>
          prev.map((p) =>
            p.id !== found.pairing.id
              ? p
              : { ...p, sessions: p.sessions.map((s) => (s.id === id ? { ...s, mentorPreviewAt: new Date().toISOString() } : s)) },
          ),
        );
      } catch (e) {
        console.warn("[sesi] preview stamp failed", e);
      }
    }
  }

  // ── AI assist (Phase D.2) ───────────────────────────────────
  //
  // We have three input modes. All of them resolve to the same POST body
  // shape — { text | driveUrl | fileText } — and the route returns a draft
  // that prefills (but does not save) the laporan form.
  function openAi(mode: "text" | "drive" | "file") {
    setAiMode(mode);
    setAiInput("");
    setAiError(null);
    setAiResult(null);
    if (mode === "file") {
      // Trigger the hidden <input type="file"> right away.
      setTimeout(() => aiFileRef.current?.click(), 0);
    }
  }

  function closeAi() {
    if (aiBusy) return;
    setAiMode(null);
    setAiInput("");
    setAiError(null);
    setAiResult(null);
  }

  async function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error("Gagal membaca file"));
      r.readAsText(file);
    });
  }

  async function handleAiFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiBusy(true);
    setAiError(null);
    try {
      // For text-like files we can pass the contents straight through. PDF
      // and DOCX would need server-side parsing; we punt those for now and
      // tell the mentor to paste the text manually instead.
      const isText = file.type.startsWith("text/") || /\.(txt|md|rtf|csv|vtt)$/i.test(file.name);
      if (!isText) {
        throw new Error(
          `Format "${file.type || file.name.split(".").pop()}" belum didukung. Coba paste isi dokumen ke kotak teks, atau export ke .txt dulu.`,
        );
      }
      const fileText = await readFileAsText(file);
      if (fileText.length < 50) throw new Error("Isi file terlalu pendek untuk diringkas.");
      await runAi({ fileText, fileName: file.name });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
      setAiBusy(false);
    } finally {
      // Reset the input so re-uploading the same file fires the change event.
      if (aiFileRef.current) aiFileRef.current.value = "";
    }
  }

  async function runAi(body: Record<string, unknown>) {
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/aigen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAiResult(data.draft);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiBusy(false);
    }
  }

  function submitAiInput() {
    const trimmed = aiInput.trim();
    if (!trimmed) {
      setAiError("Isi dulu kotaknya — paste catatan atau link Drive.");
      return;
    }
    if (aiMode === "drive") {
      runAi({ driveUrl: trimmed });
    } else {
      runAi({ text: trimmed });
    }
  }

  /** Apply the Gemini draft to the laporan form fields. Topic + summary +
   *  obstacles always go in; mentorNotes goes into keyOutput (the "Catatan
   *  privat mentor" field); menteeEnergy only fills if the form is empty. */
  function applyAiDraft() {
    if (!aiResult || !found) return;
    const base: DraftFields = draftEdits ?? fromSession(found.session);
    const next: DraftFields = {
      ...base,
      topic: aiResult.topic || base.topic,
      summaryNotes: aiResult.summary || base.summaryNotes,
      obstacles: aiResult.obstacles || base.obstacles,
      keyOutput: aiResult.mentorNotes
        ? base.keyOutput
          ? `${base.keyOutput}\n\n[Pengamatan AI]\n${aiResult.mentorNotes}`
          : aiResult.mentorNotes
        : base.keyOutput,
      menteeEnergy: base.menteeEnergy ?? aiResult.menteeEnergy,
    };
    setDraft(next);
    queueSave(next);
    closeAi();
  }

  // "Setuju & kirim" — finalise, stamp mentorSubmittedAt + status=completed.
  async function handleSubmit() {
    if (!found || submitting) return;
    setSubmitting(true);
    try {
      await patchSession({ mentorSubmittedAt: true, status: "completed" });
      setConfirmSubmitOpen(false);
      window.location.reload();
    } catch (e) {
      setSubmitting(false);
      console.error("[sesi] submit failed", e);
    }
  }

  /* ── Loading & error ─────────────────────────────────────────── */

  if (loading) return <SkeletonDashboard />;
  if (error || !found) {
    return (
      <div className="page" style={{ padding: "40px 32px" }}>
        <h1 className="sesi-title">Sesi tidak ditemukan.</h1>
        <p className="sesi-sub">
          {error
            ? `Terjadi kesalahan: ${error}`
            : "Sesi yang kamu cari tidak ada — atau kamu tidak punya akses. Kembali ke Beranda dan pilih sesi lain."}
        </p>
        <Link href="/dashboard" className="db-btn db-btn-outline" style={{ marginTop: 16 }}>
          ← Kembali ke Beranda
        </Link>
      </div>
    );
  }

  const { pairing, session } = found;
  if (!effectiveDraft || effectivePhase === null) return <SkeletonDashboard />;
  // Alias to keep the JSX below readable. These are the values the
  // user actually sees and edits.
  const draft = effectiveDraft;
  const activePhase = effectivePhase;

  const mentee = pairing.mentee;
  const phaseLabel = PHASE_LABELS[session.phase] || session.phase;
  const isMenteeRole = me?.id === mentee.id;
  const isMentorRole = me?.id === pairing.mentor.id;

  // Sort the journey rail.
  const journey = [...pairing.sessions].sort((a, b) => a.sessionNum - b.sessionNum);

  // Save-status label.
  const savedAgo = lastSavedAt ? Math.floor((now.getTime() - lastSavedAt.getTime()) / 1000) : null;
  const savedLabel =
    saving === "saving" ? "menyimpan…"
      : saving === "error" ? "gagal simpan"
      : savedAgo !== null ? `Tersimpan otomatis · ${fmtAgo(savedAgo)}`
      : "Belum ada perubahan";

  // Lifecycle status for the phase strip pills.
  const sebelumDone = !!session.prepCompletedAt;
  const setelahDone = !!session.mentorSubmittedAt;

  // Countdown for the Sebelum hero.
  const scheduledDate = parseTs(session.scheduledAt);
  const countdown = scheduledDate ? fmtCountdown(scheduledDate.getTime(), now.getTime()) : null;

  // Carry-forward from previous session.
  const prevSession = journey.find((s) => s.sessionNum === session.sessionNum - 1) || null;
  const previousNext = prevSession?.keyOutput?.trim() || prevSession?.summaryNotes?.trim() || null;

  // Pre-flight "Sebelum kamu kirim" checklist.
  const checks = [
    { ok: !!draft.topic && !!draft.summaryNotes, label: "Topik & ringkasan terisi" },
    { ok: draft.menteeEnergy !== null, label: "Mood mentee dipilih" },
    { ok: !!draft.obstacles, label: "Catat hambatan kalau ada" },
    { ok: !!session.mentorRating, label: "Kasih bintang ke sesi (opsional)" },
  ];

  // Pretty headline for each phase.
  const phaseSubtitle: Record<Phase, string> = {
    sebelum: "Persiapan ringkas sebelum kalian ngobrol. Centang yang sudah, buka Meet, lalu mulai sesi.",
    setelah: "Catat topik, ringkasan, mood, dan langkah berikutnya — tersimpan otomatis tiap kamu mengetik.",
    mentee: "Beginilah ringkasan yang akan mentee terima. Pratinjau sebelum kamu kirim — tidak ada catatan privat di sini.",
  };

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">
            <Link href="/dashboard/mentee">Mentee</Link>
            {" › "}
            <Link href={`/dashboard/pairings/${pairing.id}`}>{mentee.name}</Link>
            {" › "}
            <span style={{ color: "var(--text-muted)" }}>Sesi {session.sessionNum}</span>
          </div>
          <h1 className="sesi-title">
            Sesi {session.sessionNum}{" "}
            <span className="lede">— {session.topic || "Sesi mentoring"}.</span>
          </h1>
          <p className="sesi-sub">{phaseSubtitle[activePhase]}</p>
        </div>
      </div>

      {/* ── Phase strip ───────────────────────────────────────── */}
      <div className="phase-strip" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activePhase === "sebelum"}
          className={`phase ${activePhase === "sebelum" ? "on" : sebelumDone ? "done" : ""}`}
          onClick={() => !isMenteeRole && gotoPhase("sebelum")}
          disabled={isMenteeRole}
        >
          <span className="phase-num">1</span>
          Sebelum sesi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePhase === "setelah"}
          className={`phase ${activePhase === "setelah" ? "on" : setelahDone ? "done" : ""}`}
          onClick={() => !isMenteeRole && gotoPhase("setelah")}
          disabled={isMenteeRole}
        >
          <span className="phase-num">2</span>
          Setelah sesi · isi laporan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePhase === "mentee"}
          className={`phase ${activePhase === "mentee" ? "on" : ""}`}
          onClick={() => gotoPhase("mentee")}
        >
          <span className="phase-num">3</span>
          {isMenteeRole ? "Ringkasan kamu" : "Pratinjau yang mentee lihat"}
        </button>
      </div>

      <div className="sesi-grid">
        <div className="sesi-main">
          {/* ── Phase 1: Sebelum sesi ───────────────────────────── */}
          {activePhase === "sebelum" && (
            <>
              <section className="sesi-hero">
                <div className="head">
                  <div className="av-grad lg av-c1">{initials(mentee.name)}</div>
                  <div className="info">
                    <div className="crumb">
                      {countdown ? countdown.label : "Belum dijadwalkan"}
                      {" · "}
                      {phaseLabel}
                    </div>
                    <h2>{mentee.name}</h2>
                    <div className="meta-line">
                      {pairing.menteeProfile?.intendedStudyProgram && (
                        <span>
                          Target: <b>{pairing.menteeProfile.intendedStudyProgram}</b>
                          {pairing.menteeProfile.preferredDestinations && ` · ${pairing.menteeProfile.preferredDestinations}`}
                        </span>
                      )}
                      {pairing.targetProgram && !pairing.menteeProfile?.intendedStudyProgram && (
                        <span>Target: <b>{pairing.targetProgram}</b></span>
                      )}
                      <span className="dot" />
                      <span>{mentee.email}</span>
                    </div>
                  </div>
                </div>
                <div className="actions">
                  <div className="meet-link">
                    <span className="gico">M</span>
                    {meetLinkOverride ? (
                      <a
                        href={meetLinkOverride}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="url meet-url-live"
                      >
                        {meetLinkOverride.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="url">Belum ada Meet — akan dibuat saat &ldquo;Mulai sesi&rdquo;</span>
                    )}
                    {meetLinkOverride && (
                      <button
                        type="button"
                        className="copy"
                        title="Salin"
                        onClick={() => navigator.clipboard?.writeText(meetLinkOverride)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="db-btn db-btn-primary"
                    onClick={handleStartSession}
                    disabled={startBusy}
                  >
                    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                    {startBusy ? "Membuat Meet…" : meetLinkOverride ? "Buka Meet & lanjut" : "Mulai sesi"}
                  </button>
                </div>
                {startError && (
                  <div className="ai-error" style={{ marginTop: 12 }}>
                    {startError}
                  </div>
                )}
              </section>

              {/* Prep checklist */}
              <section className="prep-card">
                <div className="prep-head">
                  <h3>Checklist persiapan</h3>
                  <span className="prep-count">
                    {prep ? `${prep.filter((p) => p.done).length}/${prep.length}` : "…"} siap
                  </span>
                </div>
                {prepLoading ? (
                  <div className="prep-loading">Memuat checklist…</div>
                ) : !prep || prep.length === 0 ? (
                  <div className="prep-loading">Tidak ada item checklist.</div>
                ) : (
                  <ul className="prep-list">
                    {prep.map((item) => (
                      <li key={item.id} className={`prep-item ${item.done ? "done" : ""} ${item.warn ? "warn" : ""}`}>
                        <label className="prep-toggle">
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => togglePrep(item.id)}
                          />
                          <span className="prep-check" aria-hidden="true">
                            {item.done ? "✓" : ""}
                          </span>
                        </label>
                        <div className="prep-body">
                          <div className="prep-label">{item.label}</div>
                          {item.sub && <div className="prep-sub">{item.sub}</div>}
                        </div>
                        {item.actionLink && (
                          <Link href={item.actionLink} className="prep-action">
                            {item.actionLabel || "buka →"}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Carry-forward from last session */}
              {previousNext && (
                <section className="carry-card">
                  <div className="carry-head">
                    <span className="carry-tag">Dari Sesi {prevSession?.sessionNum}</span>
                    <h3>Janji + carry-forward</h3>
                  </div>
                  <p className="carry-text">{previousNext}</p>
                  <Link href={`/dashboard/sesi/${prevSession?.id}`} className="carry-link">
                    Buka laporan sesi sebelumnya →
                  </Link>
                </section>
              )}

              {/* Saran agenda 60 menit */}
              <section className="agenda-card">
                <div className="agenda-head">
                  <h3>Saran agenda 60 menit</h3>
                  <span className="agenda-tag">Fase {phaseLabel}</span>
                </div>
                <ol className="agenda-list">
                  {(AGENDA_BY_PHASE[session.phase] || AGENDA_BY_PHASE.planning).map((row, i) => (
                    <li key={i} className="agenda-row">
                      <span className="agenda-slot">{row.slot}</span>
                      <span className="agenda-topic">{row.topic}</span>
                    </li>
                  ))}
                </ol>
                <p className="agenda-foot">
                  Agenda ini cuma saran. Sesuaikan dengan kondisi mentee — yang penting ada check-in,
                  inti, dan janji untuk sesi berikutnya.
                </p>
              </section>
            </>
          )}

          {/* ── Phase 2: Setelah sesi · isi laporan ──────────────── */}
          {activePhase === "setelah" && isMentorRole && (
            <section className="report-card">
              <div className="head">
                <h3>Laporan sesi</h3>
                <span className={`save-status ${saving === "saving" ? "saving" : ""}`}>{savedLabel}</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="topic">
                  Topik pembahasan
                  <span className="req">*</span>
                  <span className="who-sees">mentee + admin lihat</span>
                </label>
                <input
                  id="topic"
                  className="input"
                  placeholder="Apa fokus utama sesi ini?"
                  value={draft.topic}
                  onChange={(e) => update("topic", e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="summary">
                  Ringkasan sesi
                  <span className="req">*</span>
                  <span className="who-sees">mentee + admin lihat</span>
                </label>
                <textarea
                  id="summary"
                  className="textarea lg"
                  placeholder="Apa yang dibahas? Apa kesimpulan kamu sebagai mentor?"
                  value={draft.summaryNotes}
                  onChange={(e) => update("summaryNotes", e.target.value)}
                />

                <div className="ai-box">
                  <span className="ic">a</span>
                  <div className="body">
                    <b>Bantuan AI</b> <span className="db-pill static accent">Segera hadir</span> — nanti
                    kamu bisa paste catatan Meet, link Drive, atau upload .txt dan dapat draf laporan otomatis.
                    Untuk sekarang, isi laporan langsung di form ini — tersimpan otomatis tiap kamu mengetik.
                    <div className="actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={aiBusy}
                        onClick={() => openAi("text")}
                      >
                        Hasilkan draf laporan
                      </button>
                      <button type="button" disabled={aiBusy} onClick={() => openAi("drive")}>
                        Tempel link Drive
                      </button>
                      <button type="button" disabled={aiBusy} onClick={() => openAi("file")}>
                        Upload catatan
                      </button>
                    </div>
                  </div>
                </div>
                {/* Hidden file input — opened by the "Upload catatan" button */}
                <input
                  ref={aiFileRef}
                  type="file"
                  accept=".txt,.md,.csv,.rtf,.vtt,text/plain"
                  style={{ display: "none" }}
                  onChange={handleAiFile}
                />
              </div>

              <div className="field">
                <label className="field-label">
                  Mood mentee hari ini
                  <span className="who-sees private">cuma mentor + admin</span>
                </label>
                <div className="mood-row">
                  {MOODS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      className={`mood ${draft.menteeEnergy === m.value ? "on" : ""}`}
                      onClick={() => update("menteeEnergy", draft.menteeEnergy === m.value ? null : m.value)}
                    >
                      <span className="face">{m.face}</span>
                      <span className="lbl-m">{m.label}</span>
                    </button>
                  ))}
                </div>
                <div className="helper">Tracking mood membantu kamu lihat tren mentee lintas sesi.</div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="obstacles">
                  Hambatan / kekhawatiran
                  <span className="who-sees">mentee + admin lihat</span>
                </label>
                <textarea
                  id="obstacles"
                  className="textarea"
                  placeholder="Apa yang menahan mentee?"
                  value={draft.obstacles}
                  onChange={(e) => update("obstacles", e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="notes">
                  Catatan privat mentor
                  <span className="who-sees private">hanya kamu</span>
                </label>
                <textarea
                  id="notes"
                  className="textarea"
                  placeholder="Pengamatan jujur, hal yang tidak perlu dibagikan ke mentee. Berguna untuk sesi berikutnya."
                  value={draft.keyOutput}
                  onChange={(e) => update("keyOutput", e.target.value)}
                />
              </div>

              <div className="form-footer">
                <span className="draft-info">
                  Draft tersimpan otomatis. Mentee & admin baru lihat setelah kamu pratinjau & kirim.
                </span>
                <button
                  type="button"
                  className="db-btn db-btn-outline"
                  onClick={() => gotoPhase("mentee")}
                >
                  Pratinjau yang mentee lihat →
                </button>
              </div>
            </section>
          )}

          {/* ── Phase 3: Mentee POV ──────────────────────────────── */}
          {activePhase === "mentee" && (
            <section className={`mentee-pov ${session.mentorSubmittedAt ? "is-submitted" : "is-preview"}`}>
              <div className="pov-hero">
                <div className="pov-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div className="pov-body">
                  <div className="pov-tag">
                    {session.mentorSubmittedAt
                      ? "Sudah dikirim ke mentee"
                      : "Pratinjau · belum dikirim"}
                  </div>
                  <h2>
                    {isMenteeRole
                      ? `Ringkasan Sesi ${session.sessionNum} untuk kamu`
                      : `Beginilah yang ${mentee.name.split(/\s+/)[0]} akan lihat`}
                  </h2>
                  <p>
                    Tanpa catatan privat, mood, dan tracking internal. Hanya bagian yang aman dibagikan.
                  </p>
                </div>
              </div>

              <div className="pov-grid">
                <div className="pov-field">
                  <div className="pov-label">Topik pembahasan</div>
                  <div className="pov-value">
                    {draft.topic || <em className="pov-empty">Belum diisi.</em>}
                  </div>
                </div>
                <div className="pov-field">
                  <div className="pov-label">Ringkasan sesi</div>
                  <div className="pov-value pov-prose">
                    {draft.summaryNotes || <em className="pov-empty">Belum diisi.</em>}
                  </div>
                </div>
                <div className="pov-field">
                  <div className="pov-label">Hambatan / kekhawatiran</div>
                  <div className="pov-value">
                    {draft.obstacles || <em className="pov-empty">Tidak ada hambatan yang dicatat.</em>}
                  </div>
                </div>
              </div>

              <div className="pov-footer">
                {isMentorRole ? (
                  session.mentorSubmittedAt ? (
                    <>
                      <span className="pov-stamp">
                        Dikirim {parseTs(session.mentorSubmittedAt)?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        {session.menteeViewedAt && (
                          <>
                            {" · "}
                            <b>dilihat mentee</b> {parseTs(session.menteeViewedAt)?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        className="db-btn db-btn-outline"
                        onClick={() => gotoPhase("setelah")}
                      >
                        Edit laporan
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="pov-stamp">
                        Setelah kamu kirim, mentee akan dapat notifikasi + email.
                      </span>
                      <button
                        type="button"
                        className="db-btn db-btn-outline"
                        onClick={() => gotoPhase("setelah")}
                      >
                        ← Edit laporan
                      </button>
                      <button
                        type="button"
                        className="db-btn db-btn-primary"
                        onClick={() => setConfirmSubmitOpen(true)}
                      >
                        <Icon name="check" size={16} />
                        Setuju & kirim
                      </button>
                    </>
                  )
                ) : isMenteeRole && session.mentorSubmittedAt ? (
                  <span className="pov-stamp">
                    Diterima dari {pairing.mentor.name.split(/\s+/)[0]} · {parseTs(session.mentorSubmittedAt)?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                ) : (
                  <span className="pov-stamp">Mentor belum mengirim laporan ini.</span>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── Side rail ─────────────────────────────────────────── */}
        <aside className="sesi-side">
          <div className="sesi-side-card">
            <h4>Perjalanan dengan {mentee.name.split(/\s+/)[0]}</h4>
            {journey.map((s) => {
              const isCur = s.id === session.id;
              const isDone = s.status === "completed";
              const whenLabel = isCur
                ? "sesi ini"
                : s.completedAt
                  ? fmtDayShort(new Date(s.completedAt))
                  : s.scheduledAt
                    ? fmtDayShort(new Date(s.scheduledAt))
                    : "—";
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/sesi/${s.id}`}
                  className={`journey-row ${isCur ? "cur" : ""} ${isDone && !isCur ? "done" : ""}`}
                >
                  <span className="num">{isDone && !isCur ? "" : s.sessionNum}</span>
                  <span className="name">
                    Sesi {s.sessionNum} — {s.topic || PHASE_LABELS[s.phase] || "Sesi"}
                  </span>
                  <span className="when">{whenLabel}</span>
                </Link>
              );
            })}
          </div>

          <div className="sesi-side-mat">
            <span className="tag">Materi terkait sesi {session.sessionNum}</span>
            <h4>Pegangan untuk laporan ini</h4>
            <div className="mat-row">
              <span className="name">Panduan {phaseLabel}</span>
              <Link href="/dashboard/resources">buka →</Link>
            </div>
            <div className="mat-row">
              <span className="name">Contoh laporan terbaik</span>
              <Link href="/dashboard/resources">buka →</Link>
            </div>
            <div className="mat-row">
              <span className="name">Template feedback singkat</span>
              <Link href="/dashboard/resources">buka →</Link>
            </div>
          </div>

          {activePhase === "setelah" && (
            <div className="sesi-side-card">
              <h4>Sebelum kamu kirim</h4>
              <div className="send-check">
                {checks.map((c, i) => (
                  <div key={i} className={`send-check-item ${c.ok ? "" : "todo"}`}>
                    <span className={c.ok ? "icon-y" : "icon-n"}>{c.ok ? "✓" : "○"}</span>
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ── AI assist modal (text / drive — file goes straight through) ─ */}
      {aiMode && aiMode !== "file" && (
        <div className="sesi-modal-backdrop" onClick={closeAi}>
          <div className="sesi-modal ai-modal" onClick={(e) => e.stopPropagation()}>
            {aiResult ? (
              <>
                <div className="ai-modal-head">
                  <span className="ai-modal-pill">draf siap</span>
                  <h3>Cek draf dari Gemini</h3>
                  <p>
                    Edit dulu kalau ada yang melenceng. Setelah kamu klik &ldquo;Terapkan&rdquo;,
                    isinya dipindahin ke form laporan dan masih bisa kamu ubah lagi sebelum kirim.
                  </p>
                </div>
                <div className="ai-preview">
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Topik</span>
                    <div className="ai-preview-value">{aiResult.topic || <em>—</em>}</div>
                  </div>
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Ringkasan</span>
                    <div className="ai-preview-value">{aiResult.summary || <em>—</em>}</div>
                  </div>
                  {aiResult.obstacles && (
                    <div className="ai-preview-field">
                      <span className="ai-preview-label">Hambatan</span>
                      <div className="ai-preview-value">{aiResult.obstacles}</div>
                    </div>
                  )}
                  {aiResult.mentorNotes && (
                    <div className="ai-preview-field">
                      <span className="ai-preview-label">Catatan privat (mentor only)</span>
                      <div className="ai-preview-value">{aiResult.mentorNotes}</div>
                    </div>
                  )}
                  {aiResult.menteeEnergy != null && (
                    <div className="ai-preview-field">
                      <span className="ai-preview-label">Tebakan mood</span>
                      <div className="ai-preview-value">{MOODS.find((m) => m.value === aiResult.menteeEnergy)?.face} {MOODS.find((m) => m.value === aiResult.menteeEnergy)?.label}</div>
                    </div>
                  )}
                </div>
                <div className="sesi-modal-actions">
                  <button type="button" className="db-btn db-btn-outline" onClick={closeAi}>Batal</button>
                  <button type="button" className="db-btn db-btn-primary" onClick={applyAiDraft}>
                    Terapkan ke laporan →
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{aiMode === "drive" ? "Tempel link Drive" : "Paste catatan Meet / draf"}</h3>
                <p>
                  {aiMode === "drive"
                    ? "Pastikan Doc / file Drive di-share \"Anyone with the link can view\". Kalau private, paste isinya manual via tombol Hasilkan draf."
                    : "Tempel transkrip Meet, catatan kasar, atau apapun teks mentah dari sesi tadi. Minimal ~50 karakter."}
                </p>
                {aiMode === "drive" ? (
                  <input
                    type="url"
                    className="input"
                    placeholder="https://docs.google.com/document/d/..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={aiBusy}
                    autoFocus
                  />
                ) : (
                  <textarea
                    className="textarea lg"
                    placeholder="Mentee bilang dia mulai bingung mau ambil jurusan psikologi atau public health…"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    disabled={aiBusy}
                    autoFocus
                    style={{ minHeight: 200 }}
                  />
                )}
                {aiError && <div className="ai-error">{aiError}</div>}
                <div className="sesi-modal-actions">
                  <button type="button" className="db-btn db-btn-outline" onClick={closeAi} disabled={aiBusy}>
                    Batal
                  </button>
                  <button type="button" className="db-btn db-btn-primary" onClick={submitAiInput} disabled={aiBusy}>
                    {aiBusy ? "Memproses…" : "Hasilkan draf →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Inline spinner / error while file upload is in flight (no modal) */}
      {aiMode === "file" && (aiBusy || aiError || aiResult) && (
        <div className="sesi-modal-backdrop" onClick={closeAi}>
          <div className="sesi-modal ai-modal" onClick={(e) => e.stopPropagation()}>
            {aiBusy && <p style={{ margin: 0 }}>Memproses file…</p>}
            {aiError && (
              <>
                <h3>File tidak bisa diproses</h3>
                <p>{aiError}</p>
                <div className="sesi-modal-actions">
                  <button type="button" className="db-btn db-btn-outline" onClick={closeAi}>Tutup</button>
                </div>
              </>
            )}
            {aiResult && (
              <>
                <div className="ai-modal-head">
                  <span className="ai-modal-pill">draf siap</span>
                  <h3>Cek draf dari Gemini</h3>
                </div>
                <div className="ai-preview">
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Topik</span>
                    <div className="ai-preview-value">{aiResult.topic || <em>—</em>}</div>
                  </div>
                  <div className="ai-preview-field">
                    <span className="ai-preview-label">Ringkasan</span>
                    <div className="ai-preview-value">{aiResult.summary || <em>—</em>}</div>
                  </div>
                  {aiResult.mentorNotes && (
                    <div className="ai-preview-field">
                      <span className="ai-preview-label">Catatan privat (mentor only)</span>
                      <div className="ai-preview-value">{aiResult.mentorNotes}</div>
                    </div>
                  )}
                </div>
                <div className="sesi-modal-actions">
                  <button type="button" className="db-btn db-btn-outline" onClick={closeAi}>Batal</button>
                  <button type="button" className="db-btn db-btn-primary" onClick={applyAiDraft}>
                    Terapkan ke laporan →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm submit modal ───────────────────────────────── */}
      {confirmSubmitOpen && (
        <div className="sesi-modal-backdrop" onClick={() => !submitting && setConfirmSubmitOpen(false)}>
          <div className="sesi-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Kirim laporan ke {mentee.name.split(/\s+/)[0]}?</h3>
            <p>
              Setelah dikirim, mentee dapat email + notifikasi, dan status sesi berubah jadi
              <b> selesai</b>. Kamu masih bisa edit nanti — tapi mentee akan lihat versi sekarang.
            </p>
            <div className="sesi-modal-actions">
              <button
                type="button"
                className="db-btn db-btn-outline"
                onClick={() => setConfirmSubmitOpen(false)}
                disabled={submitting}
              >
                Batal
              </button>
              <button
                type="button"
                className="db-btn db-btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Mengirim…" : "Ya, kirim sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
