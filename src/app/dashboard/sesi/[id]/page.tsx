/** Sesi (adaptive) — Dashboard-7 redesign.
 *
 *  One page per session (/dashboard/sesi/[id]). The left column re-renders
 *  based on the session's derived status; the right rail lists every session
 *  in the pairing and lets the mentor jump between them.
 *
 *    done     → read view: ringkasan + catatan mentor (mentor can re-edit).
 *    current  → prep checklist + saran agenda + isi laporan (the active one).
 *    upcoming → preview: yang akan dibahas + agenda draft + persiapan kamu.
 *
 *  Lifecycle is tracked with four Session timestamps:
 *    prepCompletedAt    → set when mentor clicks "Mulai sesi"
 *    mentorPreviewAt    → set when mentor first opens "Pratinjau mentee"
 *    mentorSubmittedAt  → set when mentor presses "Setuju & kirim"
 *    menteeViewedAt     → set when the mentee opens the report
 *
 *  Mentee role sees a stripped, read-only variant of the submitted report.
 */

"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import Link from "next/link";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { cleanUniName } from "@/data/university-enrichment";
import { CURRICULUM } from "@/lib/curriculum";
import { classifyDoc } from "@/lib/doc-templates";
import { MATERIALS } from "@/data/materials";
import type { PrepItem } from "@/app/api/sessions/[id]/prep/route";

/** Map a curriculum doc-checklist label to a Document category. */
function docChecklistCategory(item: string): string {
  const t = item.toLowerCase();
  if (/\bcv\b|resume/.test(t)) return "cv";
  if (/transcript|transkrip|ijazah/.test(t)) return "transcript";
  if (/language|ielts|toefl|bahasa/.test(t)) return "ielts";
  if (/motivation|narrative|\bml\b|\bps\b/.test(t)) return "motivation_letter";
  if (/lpdp|essay|esai/.test(t)) return "essay_lpdp";
  if (/recommendation|rekomendasi/.test(t)) return "recommendation";
  if (/certificate|sertifikat/.test(t)) return "certificate";
  return "other";
}

/* ─── Data shapes ─────────────────────────────────────────────────── */

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  whatsapp?: string | null; // mentor's WhatsApp number (from onboarding)
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
  durationMinutes?: number | null;
  objective?: string | null;        // published from the mentor's session plan
  deliverables?: string[] | null;   // published from the mentor's session plan
  docChecklist?: string[] | null; // published from the mentor's session plan
  prepCompletedAt?: string | null;
  mentorPreviewAt?: string | null;
  mentorSubmittedAt?: string | null;
  menteeViewedAt?: string | null;
}

interface Pairing {
  id: string;
  targetProgram?: string | null;
  priorityUnis?: string | null; // JSON array of university names — the mentee's Kampus shortlist
  mentor: User;
  mentee: User;
  sessions: SessionRow[];
  menteeProfile?: { intendedStudyProgram?: string; preferredDestinations?: string } | null;
}

interface TaskRow {
  id: string;
  pairingId: string;
  sessionNum?: number | null;
  title: string;
  description?: string | null;
  status: string; // "pending" | "in_progress" | "completed" | "overdue"
  dueDate?: string | null;
  completedAt?: string | null;
}

interface DocRow {
  id: string;
  pairingId: string;
  sessionNum?: number | null;
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  category: string;
  uploadedBy?: string | null;
  createdAt?: string | null;
}

type SavingState = "idle" | "saving" | "saved" | "error";

/* ─── Helpers ─────────────────────────────────────────────────────── */

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtDayShort(d: Date): string {
  return `${d.getDate()} ${ID_MONTHS[d.getMonth()]}`;
}
/** Build a wa.me link from an Indonesian phone number. Strips non-digits and
 *  normalizes a leading 0 → 62. Returns null if there's nothing usable. */
function waLink(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (digits.startsWith("8")) digits = "62" + digits;
  return `https://wa.me/${digits}`;
}
function fmtAgo(seconds: number): string {
  if (seconds < 5) return "baru saja";
  if (seconds < 60) return `${seconds} dtk lalu`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

/** Countdown / since label for the current-session hero. */
function fmtCountdown(targetMs: number, nowMs: number): { label: string; tone: "future" | "soon" | "past" } {
  const diff = targetMs - nowMs;
  const absMin = Math.floor(Math.abs(diff) / 60_000);
  if (diff < 0) {
    if (absMin < 60) return { label: `dimulai ${absMin} mnt lalu`, tone: "past" };
    const h = Math.floor(absMin / 60);
    if (h < 24) return { label: `dimulai ${h} jam lalu`, tone: "past" };
    const d = Math.floor(h / 24);
    return { label: `dimulai ${d} hari lalu`, tone: "past" };
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

/** AI report-draft (Gemini) is deferred — /api/sessions/[id]/aigen is a stub.
 *  Hide the AI entry points until the feature is wired up. Flip to true (and
 *  restore src/lib/gemini.ts + the real aigen route) to re-enable. */
const AI_ENABLED: boolean = false;

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

type ViewStatus = "done" | "current" | "upcoming";

/* ─── Icons (inline) ──────────────────────────────────────────────── */

const IcPen = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const IcChat = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const IcPlay = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" /></svg>
);
const IcCal = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);
const IcCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

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
  // user presses the button. Used to show the real Meet link.
  const [meetLinkOverride, setMeetLinkOverride] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Redesign (Dashboard-7) UI state — modals + inline edit for a done report.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Per-session action items (Task) + attachments (Document).
  const [allTasks, setAllTasks] = useState<TaskRow[]>([]);
  const [allDocs, setAllDocs] = useState<DocRow[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const docFileRef = useRef<HTMLInputElement | null>(null);
  // When set, the next docFileRef upload uses this name/category (mentee's
  // curriculum checklist) instead of the file name + "other".
  const pendingDocCtx = useRef<{ name: string; category: string; label: string } | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

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

  // Load per-session action items + attachments once the pairing is known.
  const loadPairingId = found?.pairing.id ?? null;
  useEffect(() => {
    if (!loadPairingId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/pairings/${loadPairingId}/tasks`).then((r) => (r.ok ? r.json() : { tasks: [] })).catch(() => ({ tasks: [] })),
      fetch(`/api/pairings/${loadPairingId}/documents`).then((r) => (r.ok ? r.json() : { documents: [] })).catch(() => ({ documents: [] })),
    ]).then(([t, d]) => {
      if (!cancelled) {
        setAllTasks((t.tasks as TaskRow[]) || []);
        setAllDocs((d.documents as DocRow[]) || []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadPairingId]);

  // Effective draft — derived during render so we don't setState in an effect.
  const effectiveDraft: DraftFields | null = draftEdits ?? (found ? fromSession(found.session) : null);

  // Stamp menteeViewedAt the first time the mentee opens a submitted report,
  // so the mentor can see "dilihat mentee".
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

  // "Mulai sesi" — call /start, which creates a Google Calendar event with a
  // Meet link (or reuses one), saves it on the ScheduleBooking, and stamps
  // prepCompletedAt + flips status to in_progress. On 412 "needsConnect" we
  // redirect the mentor to grant the calendar.events scope.
  async function handleStartSession() {
    if (!found || startBusy) return;
    setStartBusy(true);
    setStartError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/start`, { method: "POST" });
      const data = await res.json();
      if (res.status === 412 && data.needsConnect && data.connectUrl) {
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

      // Pop the Meet open in a new tab so the mentor doesn't have to hunt.
      if (data.meetLink) window.open(data.meetLink, "_blank", "noopener,noreferrer");
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    } finally {
      setStartBusy(false);
    }
  }

  // Open the "Pratinjau mentee" modal; stamp mentorPreviewAt the first time.
  async function openPreview() {
    setPreviewOpen(true);
    if (found && !found.session.mentorPreviewAt) {
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
  function openAi(mode: "text" | "drive" | "file") {
    setAiMode(mode);
    setAiInput("");
    setAiError(null);
    setAiResult(null);
    if (mode === "file") {
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

  /** Apply the Gemini draft to the laporan form fields. */
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

  // ── Action items (Task) + attachments (Document) ─────────────
  async function addTask() {
    const title = newTaskTitle.trim();
    if (!found || !title || taskBusy) return;
    setTaskBusy(true);
    try {
      const res = await fetch(`/api/pairings/${found.pairing.id}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, sessionNum: found.session.sessionNum }),
      });
      const data = await res.json();
      if (res.ok && data.task) {
        setAllTasks((prev) => [data.task as TaskRow, ...prev]);
        setNewTaskTitle("");
      }
    } catch (e) {
      console.warn("[sesi] addTask failed", e);
    } finally {
      setTaskBusy(false);
    }
  }

  async function toggleTask(task: TaskRow) {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    setAllTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (e) {
      console.warn("[sesi] toggleTask failed", e);
    }
  }

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !found || uploadBusy) return;
    setUploadBusy(true);
    const ctx = pendingDocCtx.current;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", ctx?.name || file.name.replace(/\.[^.]+$/, ""));
      fd.append("category", ctx?.category || "other");
      fd.append("sessionNum", String(found.session.sessionNum));
      const res = await fetch(`/api/pairings/${found.pairing.id}/documents`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.document) setAllDocs((prev) => [data.document as DocRow, ...prev]);
    } catch (err) {
      console.warn("[sesi] doc upload failed", err);
    } finally {
      setUploadBusy(false);
      setUploadingItem(null);
      pendingDocCtx.current = null;
      if (docFileRef.current) docFileRef.current.value = "";
    }
  }

  /** Mentee clicks "Unggah" on a curriculum doc item → set the context and
   *  open the (shared) file picker. */
  function startCurriculumUpload(label: string, category: string) {
    pendingDocCtx.current = { name: label, category, label };
    setUploadingItem(label);
    docFileRef.current?.click();
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
  if (!effectiveDraft) return <SkeletonDashboard />;
  const draft = effectiveDraft;

  const mentee = pairing.mentee;
  const mentorFirst = pairing.mentor.name.split(/\s+/)[0];
  const mentorWa = waLink(pairing.mentor.whatsapp);
  const menteeFirst = mentee.name.split(/\s+/)[0];
  const phaseLabel = PHASE_LABELS[session.phase] || session.phase;
  const isMenteeRole = me?.id === mentee.id;
  const isMentorRole = me?.id === pairing.mentor.id;

  // Sort the journey + derive each session's status.
  const journey = [...pairing.sessions].sort((a, b) => a.sessionNum - b.sessionNum);
  const isDone = (s: SessionRow) => s.status === "completed" || !!s.mentorSubmittedAt;
  const firstActive = journey.find((s) => !isDone(s)) || null;
  const statusOf = (s: SessionRow): ViewStatus =>
    isDone(s) ? "done" : firstActive && s.id === firstActive.id ? "current" : "upcoming";
  const viewStatus = statusOf(session);
  const doneCount = journey.filter(isDone).length;

  // Save-status label.
  const savedAgo = lastSavedAt ? Math.floor((now.getTime() - lastSavedAt.getTime()) / 1000) : null;
  const savedLabel =
    saving === "saving" ? "menyimpan…"
      : saving === "error" ? "gagal simpan"
      : savedAgo !== null ? `Tersimpan otomatis · ${fmtAgo(savedAgo)}`
      : "Belum ada perubahan";

  // Countdown + carry-forward.
  const scheduledDate = parseTs(session.scheduledAt);
  const countdown = scheduledDate ? fmtCountdown(scheduledDate.getTime(), now.getTime()) : null;
  const prevSession = journey.find((s) => s.sessionNum === session.sessionNum - 1) || null;
  const previousNext = prevSession?.keyOutput?.trim() || prevSession?.summaryNotes?.trim() || null;

  const num = String(session.sessionNum).padStart(2, "0");
  const target = pairing.menteeProfile?.intendedStudyProgram || pairing.targetProgram || null;
  const summaryParas = (draft.summaryNotes || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const agendaRows = AGENDA_BY_PHASE[session.phase] || AGENDA_BY_PHASE.planning;
  // "Yang akan dibahas" content for the mentee — the session's objective +
  // deliverables, from the mentor's published plan (or the curriculum default
  // when the mentor didn't customize it during finalization). The minute-by-
  // minute agenda above is mentor-facing only.
  const curr = CURRICULUM.find((c) => c.sessionNum === session.sessionNum);
  const sessionObjective = session.objective ?? curr?.objective ?? "";
  const sessionDeliverables = (Array.isArray(session.deliverables) ? session.deliverables : null) ?? curr?.deliverables ?? [];
  const moodInfo = draft.menteeEnergy != null ? MOODS.find((m) => m.value === draft.menteeEnergy) : null;

  // Action items + attachments scoped to this session.
  const sessionTasks = allTasks.filter((t) => t.sessionNum === session.sessionNum);
  const sessionDocs = allDocs.filter((d) => d.sessionNum === session.sessionNum);

  // ════════════════════════════════════════════════════════════════
  //  MENTEE VIEW — self-contained early return (ported from the mentee
  //  design handoff "Sesi Mentee.html"). Reuses the existing se-* CSS +
  //  toggleTask; the mentor render below is untouched. Mentee sees a
  //  status-aware detail panel (done / next / upcoming) + the journey
  //  rail + "Materi untuk sesi ini" — all from real pairing data.
  // ════════════════════════════════════════════════════════════════
  if (isMenteeRole) {
    const vs = viewStatus; // "done" | "current" | "upcoming"
    const myTasks = sessionTasks;
    const prepDone = myTasks.filter((t) => t.status === "completed").length;
    const heroStatusM =
      vs === "done"
        ? session.completedAt ? `Selesai · ${fmtDayShort(new Date(session.completedAt))}` : "Selesai"
        : vs === "current"
          ? countdown ? `⏰ ${countdown.label}` : "Sesi berikutnya"
          : scheduledDate ? `Dijadwalkan · ${fmtDayShort(scheduledDate)}` : "Belum dijadwalkan";
    const summaryShown = vs === "done" && session.mentorSubmittedAt && summaryParas.length > 0;

    return (
      <main className="se-wrap">
        <div className="se-crumb">
          <Link href="/dashboard" className="back" title="Kembali ke Beranda">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          <Link href="/dashboard">Beranda</Link>
          <span className="sep">›</span>
          <Link href="/dashboard/sesi">Sesi</Link>
          <span className="sep">›</span>
          <span className="cur">Sesi {session.sessionNum}</span>
        </div>

        {/* LEFT — detail panel */}
        <div className="se-main">
          <section className={`se-hero ${vs}`}>
            <div className="se-hero-top">
              <div className="se-pills">
                <span className="se-pill-sesi" data-status={vs}>Sesi {num}</span>
                <span className="se-pill-phase" data-phase={phaseLabel}>{phaseLabel}</span>
              </div>
              <span className="se-hero-status">{heroStatusM}</span>
            </div>
            <h1>{session.topic || "Sesi mentoring"}</h1>
            <p className="se-hero-sub">
              Bersama <b>{pairing.mentor.name}</b> · mentormu{target ? ` · ${target}` : ""}
            </p>
            <div className="se-hero-actions">
              {vs === "current" && (
                <Link className="se-hero-btn" href="/dashboard/schedule"><IcCal />Pindah jadwal</Link>
              )}
              {mentorWa ? (
                <a className="se-hero-btn primary" href={mentorWa} target="_blank" rel="noopener noreferrer">
                  <IcChat />Tanya {mentorFirst}
                </a>
              ) : (
                <a className="se-hero-btn primary" href={`mailto:${pairing.mentor.email}`}>
                  <IcChat />Tanya {mentorFirst}
                </a>
              )}
            </div>
          </section>

          {vs === "done" ? (
            <>
              <section className="se-card">
                <div className="se-card-head">
                  <h2>Ringkasan dari {mentorFirst}</h2>
                  <span className="stamp">Sesi {session.sessionNum}</span>
                </div>
                <div className="se-card-body">
                  {summaryShown
                    ? summaryParas.map((p, i) => <p key={i}>{p}</p>)
                    : <p className="muted">Ringkasan dari {mentorFirst} belum tersedia untuk sesi ini.</p>}
                </div>
              </section>

              {myTasks.length > 0 && (
                <section className="se-card">
                  <div className="se-card-head">
                    <h2>Yang harus kamu kerjakan</h2>
                    <span className="stamp">{prepDone} / {myTasks.length} selesai</span>
                  </div>
                  <div className="se-list">
                    {myTasks.map((t) => {
                      const done = t.status === "completed";
                      return (
                        <div key={t.id} className={`se-ai-row ${done ? "done" : ""}`}>
                          <button type="button" className={`se-prep-ic ${done ? "ok" : "todo"}`} onClick={() => toggleTask(t)} title={done ? "Tandai belum selesai" : "Tandai selesai"} aria-label={t.title}>
                            {done ? <IcCheck /> : ""}
                          </button>
                          <span className="se-ai-text">{t.title}</span>
                          <span className="se-ai-tag">Untuk kamu</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <MenteeRatingCard
                pairingId={pairing.id}
                sessionNum={session.sessionNum}
                mentorFirst={mentorFirst}
                initialRating={session.mentorRating ?? 0}
                initialFeedback={session.menteeFeedback ?? ""}
              />
            </>
          ) : vs === "current" ? (
            <>
              <section className="se-card">
                <div className="se-card-head">
                  <h2>Persiapan kamu</h2>
                  <span className="stamp">{prepDone} / {myTasks.length} siap</span>
                </div>
                <div className="se-list">
                  {myTasks.length === 0 ? (
                    <div className="muted" style={{ padding: 4 }}>Belum ada persiapan khusus. {mentorFirst} akan menambahkan kalau ada.</div>
                  ) : (
                    myTasks.map((t) => {
                      const done = t.status === "completed";
                      const due = parseTs(t.dueDate);
                      return (
                        <div key={t.id} className="se-prep-row" style={{ cursor: "pointer" }} onClick={() => toggleTask(t)}>
                          <span className={`se-prep-ic ${done ? "ok" : "todo"}`}>{done ? <IcCheck /> : ""}</span>
                          <div className="se-prep-body">
                            <div className="se-prep-title" style={done ? { textDecoration: "line-through", color: "var(--text-muted-2)" } : undefined}>{t.title}</div>
                            {due && <div className="se-prep-sub">jatuh tempo · {fmtDayShort(due)}</div>}
                          </div>
                          <span className="se-ai-tag">Untuk kamu</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="se-card">
                <div className="se-card-head"><h2>Yang akan dibahas</h2></div>
                <div className="se-card-body">
                  <p>Sesi ini fokus pada <b>{session.topic || phaseLabel}</b>.{sessionObjective ? ` ${sessionObjective}` : ""}</p>
                </div>
                {sessionDeliverables.length > 0 && (
                  <div className="se-list">
                    {sessionDeliverables.map((d, i) => (
                      <div key={i} className="se-prep-row">
                        <span className="se-prep-ic num">{i + 1}</span>
                        <div className="se-prep-body"><div className="se-prep-title soft">{d}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              <section className="se-card">
                <div className="se-card-head"><h2>Yang akan dibahas</h2></div>
                <div className="se-card-body">
                  <p>Sesi ini fokus pada <b>{session.topic || phaseLabel}</b>. Materi & dokumen yang perlu disiapkan ada di bawah dan di tab Materi — boleh kamu lihat & siapkan kapan saja.</p>
                </div>
              </section>
            </>
          )}

          {/* Dokumen yang diperlukan — the session's deliverables, with upload.
              Open on every session (no sequential lock). */}
          {(() => {
            const checklist = (Array.isArray(session.docChecklist) ? session.docChecklist : null)
              ?? CURRICULUM.find((c) => c.sessionNum === session.sessionNum)?.docChecklist
              ?? [];
            if (checklist.length === 0) return null;
            // Match a checklist item to an uploaded doc. Match by category ONLY
            // when it's specific (not the "other" catch-all, which would let any
            // misc doc satisfy any generic item), else by name.
            const docForItem = (item: string) => {
              const cat = docChecklistCategory(item);
              const q = item.toLowerCase();
              return allDocs.find((d) =>
                (cat !== "other" && d.category === cat) ||
                d.name.toLowerCase() === q ||
                d.name.toLowerCase().includes(q)
              ) || null;
            };
            const doneN = checklist.filter((item) => !!docForItem(item)).length;
            return (
              <section className="se-card">
                <div className="se-card-head">
                  <h2>Dokumen yang diperlukan</h2>
                  <span className="stamp">{doneN} / {checklist.length} terunggah</span>
                </div>
                <p className="se-list-hint">
                  Dokumen <b>template</b> kami sediakan — unduh, isi, lalu unggah balik ke sesi.
                  Dokumen <b>punyamu</b> (CV, ijazah, paspor, dll.) kamu unggah sendiri.
                </p>
                <div className="se-list">
                  {checklist.map((item, i) => {
                    const cat = docChecklistCategory(item);
                    const doc = docForItem(item);
                    const uploaded = !!doc;
                    const spec = classifyDoc(item);
                    const isTemplate = spec.kind === "template";
                    return (
                      <div key={i} className="se-prep-row">
                        <span className={`se-prep-ic ${uploaded ? "ok" : "todo"}`}>{uploaded ? <IcCheck /> : ""}</span>
                        <div className="se-prep-body">
                          <div className="se-prep-title" style={uploaded ? { textDecoration: "line-through", color: "var(--text-muted-2)" } : undefined}>
                            {item}
                            <span className={`se-doc-tag ${isTemplate ? "tpl" : "own"}`}>
                              {isTemplate ? "template" : "punyamu"}
                            </span>
                          </div>
                          {uploaded
                            ? <div className="se-prep-sub">terunggah · {doc!.fileName}</div>
                            : isTemplate
                              ? <div className="se-prep-sub">{spec.templateUrl ? "unduh template, isi, lalu unggah" : "template menyusul · unggah hasilmu di sini"}</div>
                              : <div className="se-prep-sub">dari kamu · unggah dokumen</div>}
                        </div>
                        <div className="se-prep-actions">
                          {isTemplate && spec.templateUrl && (
                            <a className="se-prep-link" href={spec.templateUrl} target="_blank" rel="noopener noreferrer">Unduh template</a>
                          )}
                          {uploaded ? (
                            <a className="se-prep-link" href={doc!.filePath} target="_blank" rel="noopener noreferrer">lihat</a>
                          ) : (
                            <button type="button" className="se-prep-link" onClick={() => startCurriculumUpload(item, cat)} disabled={uploadBusy}>
                              {uploadingItem === item ? "Mengunggah…" : "Unggah"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Lampiran dari mentor — files the mentor shared for this session
              (download). Shows on every session, including upcoming. */}
          {(() => {
            const mentorDocs = sessionDocs.filter((d) => !d.uploadedBy || d.uploadedBy === pairing.mentor.id);
            return (
              <section className="se-card">
                <div className="se-card-head">
                  <h2>Lampiran dari {mentorFirst}</h2>
                  <span className="stamp">untuk diunduh</span>
                </div>
                {mentorDocs.length === 0 ? (
                  <div className="se-card-body">
                    <p className="muted" style={{ margin: 0 }}>Belum ada lampiran dari {mentorFirst} untuk sesi ini. Template umum ada di tab Materi.</p>
                  </div>
                ) : (
                  <div className="se-list">
                    {mentorDocs.map((d) => (
                      <a key={d.id} href={d.filePath} target="_blank" rel="noopener noreferrer" className="se-prep-row" style={{ textDecoration: "none" }}>
                        <span className="se-prep-ic" style={{ background: "var(--primary-50)", color: "var(--primary)", borderColor: "var(--primary-100)" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M5 21h14" /></svg>
                        </span>
                        <div className="se-prep-body">
                          <div className="se-prep-title">{d.name}</div>
                          <div className="se-prep-sub">{d.category} · {d.fileName}</div>
                        </div>
                        <span className="se-prep-link">Unduh</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" style={{ display: "none" }} onChange={handleDocFile} />
        </div>

        {/* RIGHT — journey rail + materi */}
        <aside className="se-rail">
          <div className="se-rail-head">
            <h3>Semua sesi</h3>
            <span className="count">{doneCount} / {journey.length}</span>
          </div>
          <div className="se-rail-list">
            {journey.map((s) => {
              const st = statusOf(s);
              const active = s.id === session.id;
              return (
                <Link key={s.id} href={`/dashboard/sesi/${s.id}`} className={`se-rail-row ${active ? "active" : ""}`}>
                  <span className={`se-rail-dot ${st}`}>{st === "done" ? <IcCheck /> : s.sessionNum}</span>
                  <div className="se-rail-info">
                    <div className="se-rail-title">{s.sessionNum}. {s.topic || PHASE_LABELS[s.phase] || "Sesi"}</div>
                    <div className="se-rail-meta">
                      {PHASE_LABELS[s.phase] || s.phase}
                      {s.completedAt ? ` · ${fmtDayShort(new Date(s.completedAt))}` : s.scheduledAt ? ` · ${fmtDayShort(new Date(s.scheduledAt))}` : ""}
                    </div>
                  </div>
                  <span className={`se-rail-badge ${st === "done" ? "selesai" : st === "current" ? "berikutnya" : "nanti"}`}>
                    {st === "done" ? "Selesai" : st === "current" ? "Berikutnya" : "Akan datang"}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="se-rail-head" style={{ marginTop: 20 }}>
            <h3>Template & materi</h3>
          </div>
          <div className="se-rail-list">
            {(() => {
              const tpl = MATERIALS.filter((m) => (m.roles === null || m.roles.includes("mentee")) && m.sessionN === session.sessionNum);
              return (
                <>
                  {tpl.map((m) => (
                    m.href && !m.locked ? (
                      <a key={m.id} href={m.href} className="se-rail-row" style={{ textDecoration: "none" }}>
                        <div className="se-rail-info"><div className="se-rail-title">{m.title}</div><div className="se-rail-meta">{m.label}</div></div>
                      </a>
                    ) : (
                      <div key={m.id} className="se-rail-row" style={{ opacity: 0.7 }}>
                        <div className="se-rail-info"><div className="se-rail-title">{m.title}</div><div className="se-rail-meta">{m.locked ? "segera" : m.label}</div></div>
                      </div>
                    )
                  ))}
                  <div style={{ fontSize: 12, color: "var(--text-muted-2)", padding: "6px 2px" }}>
                    {tpl.length === 0 ? "Belum ada template khusus sesi ini. " : ""}
                    <Link href="/dashboard/resources" style={{ color: "var(--primary)" }}>Buka tab Materi →</Link>
                  </div>
                </>
              );
            })()}
          </div>
        </aside>
      </main>
    );
  }

  // ── Hero status line + action buttons (status-aware) ─────────
  const heroStatus =
    isMenteeRole
      ? session.mentorSubmittedAt ? "Laporan diterima" : "Menunggu laporan mentor"
      : viewStatus === "done"
        ? session.completedAt ? `Selesai · ${fmtDayShort(new Date(session.completedAt))}` : "Selesai"
        : viewStatus === "current"
          ? countdown ? `⏰ ${countdown.label}` : "Siap dimulai"
          : scheduledDate ? `Dijadwalkan · ${fmtDayShort(scheduledDate)}` : "Belum dijadwalkan";

  const noteBtn = !isMenteeRole && (
    <button type="button" className="se-hero-btn" onClick={() => setNoteOpen(true)}>
      <IcPen />Catatan mentor
    </button>
  );

  let heroActions: React.ReactNode;
  if (isMenteeRole) {
    heroActions = (
      <a className="se-hero-btn" href={mentorWa ?? `mailto:${pairing.mentor.email}`}
        {...(mentorWa ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <IcChat />Hubungi {mentorFirst}
      </a>
    );
  } else if (viewStatus === "done") {
    heroActions = (
      <>
        {noteBtn}
        <a className="se-hero-btn" href={`mailto:${mentee.email}`}>
          <IcChat />Hubungi {menteeFirst}
        </a>
      </>
    );
  } else if (viewStatus === "current") {
    heroActions = (
      <>
        <button type="button" className="se-hero-btn primary" onClick={handleStartSession} disabled={startBusy}>
          <IcPlay />{startBusy ? "Membuat Meet…" : meetLinkOverride ? "Buka Meet & lanjut" : "Mulai sesi"}
        </button>
        {noteBtn}
      </>
    );
  } else {
    heroActions = (
      <>
        <Link className="se-hero-btn primary" href="/dashboard/schedule">
          <IcCal />Jadwalkan sesi
        </Link>
        {noteBtn}
      </>
    );
  }

  // ── Prep row renderer (current state) ────────────────────────
  function prepRow(item: PrepItem) {
    const tone = item.done ? "ok" : item.warn ? "warn" : "todo";
    return (
      <div key={item.id} className={`se-prep-row ${item.warn && !item.done ? "warn-row" : ""}`}>
        <button
          type="button"
          className={`se-prep-ic ${tone}`}
          onClick={() => togglePrep(item.id)}
          title={item.done ? "Tandai belum siap" : "Tandai siap"}
          aria-label={item.label}
        >
          {item.done ? <IcCheck /> : item.warn ? "!" : ""}
        </button>
        <div className="se-prep-body">
          <div className="se-prep-title">{item.label}</div>
          {item.sub && <div className="se-prep-sub">{item.sub}</div>}
        </div>
        {item.actionLink && (
          <Link href={item.actionLink} className="se-prep-link">
            {item.actionLabel || "buka"}
          </Link>
        )}
      </div>
    );
  }

  // ── Report form (current + done-edit) ────────────────────────
  const reportForm = (
    <section className="se-card">
      <div className="se-card-head">
        <h2>Isi laporan sesi</h2>
        <span className={`save-status ${saving === "saving" ? "saving" : ""}`}>{savedLabel}</span>
      </div>

      <div className="se-rf-field">
        <div className="se-rf-label">Topik pembahasan</div>
        <input className="se-rf-input" placeholder="Apa fokus utama sesi ini?" value={draft.topic} onChange={(e) => update("topic", e.target.value)} />
      </div>

      <div className="se-rf-field">
        <div className="se-rf-label">Ringkasan sesi</div>
        <textarea className="se-rf-textarea" placeholder="Apa yang dibahas? Kesimpulan kamu sebagai mentor?" value={draft.summaryNotes} onChange={(e) => update("summaryNotes", e.target.value)} />
        {AI_ENABLED && (
          <>
            <div className="se-ai-box">
              <div>
                <b>✨ Bantuan AI</b> — kalau kamu pakai Gemini Note di Google Meet, ringkasan otomatis bisa ditarik ke sini.
                <div className="se-ai-actions">
                  <button type="button" className="se-ai-gen" disabled={aiBusy} onClick={() => openAi("text")}>Hasilkan draf laporan</button>
                  <button type="button" className="se-ai-gen ghost" disabled={aiBusy} onClick={() => openAi("drive")}>Link Drive</button>
                  <button type="button" className="se-ai-gen ghost" disabled={aiBusy} onClick={() => openAi("file")}>Upload catatan</button>
                </div>
              </div>
            </div>
            <input ref={aiFileRef} type="file" accept=".txt,.md,.csv,.rtf,.vtt,text/plain" style={{ display: "none" }} onChange={handleAiFile} />
          </>
        )}
      </div>

      <div className="se-rf-field">
        <div className="se-rf-label">Mood mentee <span className="priv">privat</span></div>
        <div className="se-rf-mood">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m.value}
              className={draft.menteeEnergy === m.value ? "on" : ""}
              onClick={() => update("menteeEnergy", draft.menteeEnergy === m.value ? null : m.value)}
            >
              <span className="face">{m.face}</span>{m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="se-rf-field">
        <div className="se-rf-label">Hambatan / kekhawatiran</div>
        <textarea className="se-rf-textarea sm" placeholder="Apa yang menahan mentee?" value={draft.obstacles} onChange={(e) => update("obstacles", e.target.value)} />
      </div>

      <div className="se-rf-field">
        <div className="se-rf-label">Catatan privat mentor <span className="priv">hanya kamu</span></div>
        <textarea className="se-rf-textarea sm" placeholder="Pengamatan jujur yang tidak dibagikan ke mentee." value={draft.keyOutput} onChange={(e) => update("keyOutput", e.target.value)} />
      </div>

      <div className="se-rf-foot">
        {editMode ? (
          <>
            <button type="button" className="se-hero-btn" onClick={() => setEditMode(false)}>Selesai edit</button>
            <button type="button" className="se-hero-btn primary" onClick={openPreview}>Pratinjau mentee</button>
          </>
        ) : (
          <>
            <button type="button" className="se-hero-btn" onClick={openPreview}>Pratinjau mentee</button>
            <button type="button" className="se-hero-btn primary" onClick={() => setConfirmSubmitOpen(true)}>Kirim laporan →</button>
          </>
        )}
      </div>
    </section>
  );

  // ── Action items ("Yang {mentee} kerjakan") ──────────────────
  const actionItemsCard = (
    <section className="se-card">
      <div className="se-card-head">
        <h2>Yang {menteeFirst} kerjakan</h2>
        <span className="stamp">action items</span>
      </div>
      <div className="se-list">
        {sessionTasks.length === 0 && !isMentorRole && (
          <div className="muted" style={{ padding: 4 }}>Belum ada action item untuk sesi ini.</div>
        )}
        {sessionTasks.map((t) => {
          const done = t.status === "completed";
          return (
            <div key={t.id} className={`se-ai-row ${done ? "done" : ""}`}>
              <button
                type="button"
                className={`se-prep-ic ${done ? "ok" : "todo"}`}
                onClick={() => isMentorRole && toggleTask(t)}
                disabled={!isMentorRole}
                title={done ? "Tandai belum selesai" : "Tandai selesai"}
                aria-label={t.title}
              >
                {done ? <IcCheck /> : ""}
              </button>
              <span className="se-ai-text">{t.title}</span>
              <span className="se-ai-tag">Untuk mentee</span>
            </div>
          );
        })}
      </div>
      {isMentorRole && (
        <div className="se-ai-add">
          <input
            className="se-rf-input"
            placeholder={`Tambah action item untuk ${menteeFirst}…`}
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
            disabled={taskBusy}
          />
          <button type="button" className="se-hero-btn primary" onClick={addTask} disabled={taskBusy || !newTaskTitle.trim()}>
            {taskBusy ? "Menambah…" : "Tambah"}
          </button>
        </div>
      )}
    </section>
  );

  // ── Lampiran (attachments) ───────────────────────────────────
  const attachmentsCard = (
    <section className="se-card">
      <div className="se-card-head">
        <h2>Lampiran</h2>
        {isMentorRole && (
          <button type="button" className="se-prep-link" onClick={() => docFileRef.current?.click()} disabled={uploadBusy}>
            {uploadBusy ? "Mengunggah…" : "+ Tambah file"}
          </button>
        )}
      </div>
      <input ref={docFileRef} type="file" style={{ display: "none" }} onChange={handleDocFile} />
      {sessionDocs.length === 0 ? (
        <div className="muted" style={{ padding: 4 }}>Tidak ada lampiran di sesi ini.</div>
      ) : (
        <div className="se-files">
          {sessionDocs.map((d) => (
            <div key={d.id} className="se-file-row">
              <span className="se-file-ico">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </span>
              <div className="se-file-info">
                <div className="se-file-name">{d.name}</div>
                <div className="se-file-meta">{(d.fileSize / 1024).toFixed(0)} KB{d.createdAt ? ` · ${fmtDayShort(new Date(d.createdAt))}` : ""}</div>
              </div>
              <a className="se-file-dl" href={d.filePath} target="_blank" rel="noopener noreferrer" title="Unduh">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  // ── Body variants ────────────────────────────────────────────
  const doneBody = (
    <>
      <section className="se-card">
        <div className="se-card-head">
          <h2>Ringkasan sesi</h2>
          <span className="stamp">Sesi {session.sessionNum} · {session.completedAt ? fmtDayShort(new Date(session.completedAt)) : "selesai"}</span>
        </div>
        <div className="se-card-body">
          {summaryParas.length ? summaryParas.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">Belum ada ringkasan untuk sesi ini.</p>}
        </div>
      </section>

      {draft.obstacles && (
        <section className="se-card">
          <div className="se-card-head"><h2>Hambatan / kekhawatiran</h2></div>
          <div className="se-card-body"><p>{draft.obstacles}</p></div>
        </section>
      )}

      {isMentorRole && (draft.keyOutput || moodInfo) && (
        <section className="se-card">
          <div className="se-card-head"><h2>Catatan privat mentor</h2><span className="stamp">hanya kamu</span></div>
          <div className="se-card-body">
            {moodInfo && <p className="se-mood-chip">Mood mentee: <b>{moodInfo.face} {moodInfo.label}</b></p>}
            {draft.keyOutput ? <p>{draft.keyOutput}</p> : <p className="muted">Belum ada catatan privat.</p>}
          </div>
        </section>
      )}

      {(sessionTasks.length > 0 || isMentorRole) && actionItemsCard}
      {(sessionDocs.length > 0 || isMentorRole) && attachmentsCard}

      {isMentorRole && (
        <div className="se-foot-actions">
          <button type="button" className="se-hero-btn" onClick={() => setEditMode(true)}>Edit laporan</button>
          <button type="button" className="se-hero-btn" onClick={openPreview}>Pratinjau yang mentee lihat</button>
        </div>
      )}
    </>
  );

  const currentBody = (
    <>
      <section className="se-card">
        <div className="se-card-head">
          <h2>Persiapan</h2>
          <span className="stamp">{prep ? `${prep.filter((p) => p.done).length} siap · ${prep.filter((p) => !p.done).length} kurang` : "…"}</span>
        </div>
        <div className="se-list">
          {prepLoading ? (
            <div className="muted" style={{ padding: 4 }}>Memuat checklist…</div>
          ) : prep && prep.length ? (
            prep.map(prepRow)
          ) : (
            <div className="muted" style={{ padding: 4 }}>Tidak ada item checklist.</div>
          )}
        </div>
      </section>

      {previousNext && (
        <section className="se-card">
          <div className="se-card-head"><h2>Dari Sesi {prevSession?.sessionNum}</h2><span className="stamp">carry-forward</span></div>
          <div className="se-card-body">
            <p>{previousNext}</p>
            {prevSession && <Link className="se-prep-link" href={`/dashboard/sesi/${prevSession.id}`}>Buka laporan sesi sebelumnya →</Link>}
          </div>
        </section>
      )}

      <section className="se-card">
        <div className="se-card-head"><h2>Saran agenda</h2><span className="stamp">60 menit · {phaseLabel}</span></div>
        <div className="se-list">
          {agendaRows.map((row, i) => (
            <div key={i} className="se-prep-row">
              <span className="se-agenda-time">{row.slot}</span>
              <div className="se-prep-body"><div className="se-prep-title soft">{row.topic}</div></div>
            </div>
          ))}
        </div>
      </section>

      {isMentorRole && reportForm}
      {isMentorRole && actionItemsCard}
    </>
  );

  const upcomingBody = (
    <>
      <section className="se-card">
        <div className="se-card-head"><h2>Yang akan dibahas</h2></div>
        <div className="se-card-body">
          <p>Sesi ini fokus pada <b>{session.topic || phaseLabel}</b>. Siapkan materi terkait dan review action items dari sesi sebelumnya sebelum sesi dijadwalkan.</p>
        </div>
      </section>

      <section className="se-card">
        <div className="se-card-head"><h2>Saran agenda</h2><span className="stamp">draft</span></div>
        <div className="se-list">
          {agendaRows.map((row, i) => (
            <div key={i} className="se-prep-row">
              <span className="se-agenda-time">{row.slot}</span>
              <div className="se-prep-body"><div className="se-prep-title soft">{row.topic}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="se-card">
        <div className="se-card-head"><h2>Persiapan kamu</h2></div>
        <div className="se-list">
          {[
            "Review action items dari sesi sebelumnya",
            "Siapkan materi terkait di tab Materi",
            "Cek dokumen mentee yang baru diunggah",
          ].map((t, i) => (
            <div key={i} className="se-prep-row">
              <span className="se-prep-ic num">{i + 1}</span>
              <div className="se-prep-body"><div className="se-prep-title soft">{t}</div></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const menteeBody = session.mentorSubmittedAt ? (
    <>
      <section className="se-card">
        <div className="se-card-head"><h2>Ringkasan sesi</h2><span className="stamp">dari {mentorFirst}</span></div>
        <div className="se-card-body">
          {summaryParas.length ? summaryParas.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">—</p>}
        </div>
      </section>
      {draft.obstacles && (
        <section className="se-card">
          <div className="se-card-head"><h2>Hambatan / kekhawatiran</h2></div>
          <div className="se-card-body"><p>{draft.obstacles}</p></div>
        </section>
      )}
      <div className="se-foot-note">
        Diterima dari {mentorFirst} · {parseTs(session.mentorSubmittedAt)?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
      </div>
    </>
  ) : (
    <section className="se-card">
      <div className="se-card-body">
        <p className="muted">Laporan sesi ini belum dikirim mentor. Kamu akan dapat notifikasi begitu siap.</p>
      </div>
    </section>
  );

  const body = isMenteeRole
    ? menteeBody
    : viewStatus === "done"
      ? editMode ? reportForm : doneBody
      : viewStatus === "current"
        ? currentBody
        : upcomingBody;

  return (
    <>
      <main className="se-wrap">
        {/* Breadcrumb */}
        <div className="se-crumb">
          <Link href="/dashboard/mentee" className="back" title="Kembali ke daftar mentee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </Link>
          <Link href="/dashboard/mentee">Mentee</Link>
          <span className="sep">›</span>
          <Link href={`/dashboard/pairings/${pairing.id}`}>{mentee.name}</Link>
          <span className="sep">›</span>
          <span className="cur">Sesi {session.sessionNum}</span>
        </div>

        {/* LEFT — main content */}
        <div className="se-main">
          <section className={`se-hero ${viewStatus}`}>
            <div className="se-hero-top">
              <div className="se-pills">
                <span className="se-pill-sesi" data-status={viewStatus}>Sesi {num}</span>
                <span className="se-pill-phase" data-phase={phaseLabel}>{phaseLabel}</span>
              </div>
              <span className="se-hero-status">{heroStatus}</span>
            </div>
            <h1>{session.topic || "Sesi mentoring"}</h1>
            <p className="se-hero-sub">
              Bersama <b>{mentee.name}</b> · mentee-mu{target ? ` · ${target}` : ""}
            </p>
            <div className="se-hero-actions">{heroActions}</div>
            {viewStatus === "current" && meetLinkOverride && (
              <div className="se-meet">
                <span className="g">Meet</span>
                <a href={meetLinkOverride} target="_blank" rel="noopener noreferrer">{meetLinkOverride.replace(/^https?:\/\//, "")}</a>
                <button type="button" className="copy" title="Salin" onClick={() => navigator.clipboard?.writeText(meetLinkOverride)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
              </div>
            )}
            {startError && <div className="se-error">{startError}</div>}
          </section>

          {body}
        </div>

        {/* RIGHT — session rail */}
        <aside className="se-rail">
          <div className="se-rail-head">
            <h3>Semua sesi</h3>
            <span className="count">{doneCount} / {journey.length}</span>
          </div>
          <div className="se-rail-list">
            {journey.map((s) => {
              const st = statusOf(s);
              const active = s.id === session.id;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/sesi/${s.id}`}
                  className={`se-rail-row ${active ? "active" : ""}`}
                >
                  <span className={`se-rail-dot ${st}`}>{st === "done" ? <IcCheck /> : s.sessionNum}</span>
                  <div className="se-rail-info">
                    <div className="se-rail-title">{s.sessionNum}. {s.topic || PHASE_LABELS[s.phase] || "Sesi"}</div>
                    <div className="se-rail-meta">
                      {PHASE_LABELS[s.phase] || s.phase}
                      {s.completedAt ? ` · ${fmtDayShort(new Date(s.completedAt))}` : s.scheduledAt ? ` · ${fmtDayShort(new Date(s.scheduledAt))}` : ""}
                    </div>
                  </div>
                  <span className={`se-rail-badge ${st === "done" ? "selesai" : st === "current" ? "berikutnya" : "nanti"}`}>
                    {st === "done" ? "Selesai" : st === "current" ? "Berikutnya" : "Akan datang"}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* ── Mentee-wide overview: all documents + action items ──── */}
          {!isMenteeRole && (
            <>
              {(() => {
                let shortlist: string[] = [];
                try {
                  const v = JSON.parse(pairing.priorityUnis || "[]");
                  if (Array.isArray(v)) shortlist = v.filter((x): x is string => typeof x === "string");
                } catch { /* ignore */ }
                if (shortlist.length === 0) return null;
                return (
                  <>
                    <div className="se-rail-head" style={{ marginTop: 20 }}>
                      <h3>Shortlist kampus</h3>
                      <span className="count">{shortlist.length}</span>
                    </div>
                    <div className="se-rail-list">
                      {shortlist.map((name, i) => (
                        <div key={i} className="se-rail-row" style={{ cursor: "default" }}>
                          <div className="se-rail-info">
                            <div className="se-rail-title">{cleanUniName(name)}</div>
                            <div className="se-rail-meta">favorit {menteeFirst}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* Template sesi — program templates the mentee downloads, fills,
                  and uploads. Download-only for the mentor (no upload); personal
                  docs (CV/ijazah/etc.) are excluded since those come from the mentee. */}
              {(() => {
                const checklist = (Array.isArray(session.docChecklist) ? session.docChecklist : null)
                  ?? CURRICULUM.find((c) => c.sessionNum === session.sessionNum)?.docChecklist
                  ?? [];
                const templates = checklist
                  .map((item) => ({ item, spec: classifyDoc(item) }))
                  .filter((x) => x.spec.kind === "template");
                if (templates.length === 0) return null;
                return (
                  <>
                    <div className="se-rail-head" style={{ marginTop: 20 }}>
                      <h3>Template sesi</h3>
                      <span className="count">{templates.length}</span>
                    </div>
                    <div className="se-rail-list">
                      {templates.map(({ item, spec }, i) =>
                        spec.templateUrl ? (
                          <a key={i} href={spec.templateUrl} target="_blank" rel="noopener noreferrer" className="se-rail-row" style={{ textDecoration: "none" }}>
                            <div className="se-rail-info">
                              <div className="se-rail-title">{item}</div>
                              <div className="se-rail-meta">Unduh template</div>
                            </div>
                          </a>
                        ) : (
                          <div key={i} className="se-rail-row" style={{ cursor: "default" }}>
                            <div className="se-rail-info">
                              <div className="se-rail-title">{item}</div>
                              <div className="se-rail-meta">template menyusul</div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="se-rail-head" style={{ marginTop: 20 }}>
                <h3>Dokumen mentee</h3>
                <span className="count">{allDocs.length}</span>
              </div>
              <div className="se-rail-list">
                {allDocs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted-2)", padding: "4px 2px" }}>Belum ada dokumen.</div>
                ) : (
                  allDocs.map((d) => (
                    <a
                      key={d.id}
                      href={d.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="se-rail-row"
                      style={{ textDecoration: "none" }}
                    >
                      <div className="se-rail-info">
                        <div className="se-rail-title">{d.name}</div>
                        <div className="se-rail-meta">
                          {d.category}{d.sessionNum ? ` · Sesi ${d.sessionNum}` : ""}
                        </div>
                      </div>
                    </a>
                  ))
                )}
              </div>

              <div className="se-rail-head" style={{ marginTop: 20 }}>
                <h3>Action items</h3>
                <span className="count">{allTasks.filter((t) => t.status !== "completed").length}</span>
              </div>
              <div className="se-rail-list">
                {allTasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted-2)", padding: "4px 2px" }}>Belum ada action item.</div>
                ) : (
                  [...allTasks]
                    .sort(
                      (a, b) =>
                        Number(a.status === "completed") - Number(b.status === "completed") ||
                        (a.sessionNum ?? 0) - (b.sessionNum ?? 0),
                    )
                    .map((t) => {
                      const done = t.status === "completed";
                      return (
                        <label key={t.id} className="se-rail-row" style={{ cursor: "pointer", alignItems: "flex-start" }}>
                          <input type="checkbox" checked={done} onChange={() => toggleTask(t)} style={{ marginTop: 3, cursor: "pointer", flexShrink: 0 }} />
                          <div className="se-rail-info">
                            <div className="se-rail-title" style={{ textDecoration: done ? "line-through" : "none", color: done ? "var(--text-muted-2)" : undefined }}>
                              {t.title}
                            </div>
                            <div className="se-rail-meta">
                              {t.sessionNum ? `Sesi ${t.sessionNum}` : "Umum"}{t.dueDate ? ` · ${fmtDayShort(new Date(t.dueDate))}` : ""}
                            </div>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </>
          )}
        </aside>
      </main>

      {/* ── Pratinjau mentee modal ─────────────────────────────── */}
      {previewOpen && (
        <div className="sesi-modal-backdrop" onClick={() => setPreviewOpen(false)}>
          <div className="sesi-modal" onClick={(e) => e.stopPropagation()}>
            <span className="ai-modal-pill">pratinjau mentee</span>
            <h3>Yang {menteeFirst} akan lihat</h3>
            <p>Tanpa catatan privat &amp; mood — hanya bagian yang aman dibagikan.</p>
            <div className="ai-preview">
              <div className="ai-preview-field">
                <span className="ai-preview-label">Topik</span>
                <div className="ai-preview-value">{draft.topic || <em>—</em>}</div>
              </div>
              <div className="ai-preview-field">
                <span className="ai-preview-label">Ringkasan</span>
                <div className="ai-preview-value">{draft.summaryNotes || <em>—</em>}</div>
              </div>
              {draft.obstacles && (
                <div className="ai-preview-field">
                  <span className="ai-preview-label">Hambatan</span>
                  <div className="ai-preview-value">{draft.obstacles}</div>
                </div>
              )}
            </div>
            <div className="sesi-modal-actions">
              <button type="button" className="db-btn db-btn-outline" onClick={() => setPreviewOpen(false)}>Tutup</button>
              {isMentorRole && (
                <button type="button" className="db-btn db-btn-primary" onClick={() => { setPreviewOpen(false); setConfirmSubmitOpen(true); }}>
                  {session.mentorSubmittedAt ? "Kirim ulang →" : "Setuju & kirim →"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Catatan mentor modal ───────────────────────────────── */}
      {noteOpen && (
        <div className="sesi-modal-backdrop" onClick={() => setNoteOpen(false)}>
          <div className="sesi-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Catatan privat mentor</h3>
            <p>Pengamatan jujur soal {menteeFirst} yang tidak dibagikan ke mentee. Tersimpan otomatis.</p>
            <textarea
              className="textarea lg"
              style={{ minHeight: 160 }}
              value={draft.keyOutput}
              onChange={(e) => update("keyOutput", e.target.value)}
              placeholder="Tulis catatan privat…"
            />
            <div className="sesi-modal-actions">
              <span className={`save-status ${saving === "saving" ? "saving" : ""}`} style={{ marginRight: "auto" }}>{savedLabel}</span>
              <button type="button" className="db-btn db-btn-primary" onClick={() => setNoteOpen(false)}>Selesai</button>
            </div>
          </div>
        </div>
      )}

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
            <h3>Kirim laporan ke {menteeFirst}?</h3>
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

/* ─── Mentee → Mentor session rating ──────────────────────────────────────
   Shown on a completed session. Stars (1–5) + optional comment, saved to the
   session via PATCH (mentorRating + menteeFeedback) — the same fields the
   admin feedback summary reads. */
function MenteeRatingCard({
  pairingId, sessionNum, mentorFirst, initialRating, initialFeedback,
}: {
  pairingId: string;
  sessionNum: number;
  mentorFirst: string;
  initialRating: number;
  initialFeedback: string;
}) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialRating > 0);
  const [err, setErr] = useState("");

  async function submit() {
    if (!rating) { setErr("Pilih bintang dulu ya."); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/pairings/${pairingId}/sessions/${sessionNum}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorRating: rating, menteeFeedback: feedback.trim() || null }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setErr("Gagal mengirim. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="se-card">
      <div className="se-card-head">
        <h2>Nilai sesi & feedback ke {mentorFirst}</h2>
      </div>
      <div className="se-card-body" style={{ paddingTop: 4 }}>
        {saved ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 10, background: "var(--surface-green)", border: "1px solid var(--surface-green-border)", color: "var(--text-green)", fontSize: 13.5, fontWeight: 600, margin: "0 0 14px" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5" /></svg>
            <span>Penilaian kamu sudah terkirim ke {mentorFirst}. Makasih! Bisa diubah kapan aja.</span>
          </div>
        ) : (
          <p className="muted" style={{ margin: "0 0 12px" }}>
            Gimana sesi ini menurut kamu? Penilaian membantu {mentorFirst} & SatuTuju jaga kualitas mentoring.
          </p>
        )}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }} role="group" aria-label="Beri bintang">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => { setRating(n); setSaved(false); setErr(""); }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} bintang`}
                style={{ background: "none", border: "none", padding: 2, cursor: "pointer", lineHeight: 0 }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24"
                  fill={active ? "#f5b301" : "none"} stroke={active ? "#f5b301" : "var(--text-muted-2)"}
                  strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.9l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95L12 2.5z" />
                </svg>
              </button>
            );
          })}
        </div>
        <textarea
          className="se-rf-textarea sm"
          placeholder={`Apa yang paling membantu? Ada yang bisa lebih baik? (opsional)`}
          value={feedback}
          onChange={(e) => { setFeedback(e.target.value); setSaved(false); }}
        />
        {err && <p style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="db-btn db-btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Mengirim…" : saved ? "Perbarui penilaian" : "Kirim penilaian"}
          </button>
        </div>
      </div>
    </section>
  );
}
