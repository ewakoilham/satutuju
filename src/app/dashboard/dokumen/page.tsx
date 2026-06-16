"use client";

/**
 * Dokumen (mentee) — the mentee design handoff "Dokumen Mentee.html", wired to
 * real data: documents come from the mentee's pairing, uploads go through
 * POST /api/pairings/[id]/documents, and "Diminta {mentor}" is derived from
 * pending tasks that read like document requests. Graceful where data is thin
 * (no word-count or multi-comment threads in the model yet — we show the
 * single mentor feedback string + version number).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useUser } from "@/lib/hooks";
import { getCachedMenteePairing, refreshMenteePairing, invalidateMenteePairing } from "@/lib/mentee-pairing-cache";

interface DocRow {
  id: string;
  category: string;
  name: string;
  fileName: string;
  filePath: string;
  status: string; // "uploaded" | "under_review" | "needs_revision" | "approved"
  version: number;
  sessionNum?: number | null;
  feedback?: string | null;
  wordCount?: number | null;
  targetWords?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
interface DocComment {
  id: string;
  body: string;
  suggestedQuote?: string | null;
  createdAt: string;
  author?: { id: string; name: string; role: string } | null;
}
interface TaskRow {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  sessionNum?: number | null;
}
interface SessionLite {
  sessionNum: number;
  topic?: string | null;
  docChecklist?: string[] | null;
  enabled?: boolean | null;
}
interface Pairing {
  id: string;
  mentor: { id: string; name: string };
  documents: DocRow[];
  tasks: TaskRow[];
  sessions?: SessionLite[];
}

/* ─── Status + category mapping (real → handoff vocabulary) ───────── */
type StatusKey = "draft" | "review" | "feedback" | "done";
const STATUS: Record<string, { key: StatusKey; label: string; sw: string }> = {
  uploaded: { key: "draft", label: "Terkirim", sw: "var(--warning)" },
  under_review: { key: "review", label: "Menunggu review", sw: "var(--primary)" },
  needs_revision: { key: "feedback", label: "Ada catatan", sw: "var(--text-purple)" },
  approved: { key: "done", label: "Disetujui", sw: "var(--success)" },
};
function statusOf(s: string) {
  return STATUS[s] || { key: "draft" as StatusKey, label: s, sw: "var(--text-muted-2)" };
}

function catVisual(category: string): { tile: string; icon: string } {
  const c = category.toLowerCase();
  if (c.includes("cv") || c.includes("resume")) return { tile: "tl-amber", icon: "user" };
  if (c.includes("transcript") || c.includes("ijazah") || c.includes("certificate")) return { tile: "tl-green", icon: "graduation" };
  if (c.includes("essay") || c.includes("lpdp")) return { tile: "tl-primary", icon: "document" };
  if (c.includes("motivation")) return { tile: "tl-blue", icon: "document" };
  return { tile: "tl-muted", icon: "document" };
}
const CAT_LABEL: Record<string, string> = {
  cv: "CV / Resume",
  motivation_letter: "Motivation Letter",
  transcript: "Transkrip",
  ielts: "Skor bahasa",
  essay_lpdp: "Esai beasiswa",
  recommendation: "Surat rekomendasi",
  certificate: "Sertifikat",
  other: "Dokumen",
};

const ID_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtDate(v?: string | null): string {
  if (!v) return "";
  const s = v.includes("T") ? v : v.replace(" ", "T");
  const d = new Date(s.endsWith("Z") ? s : s + "Z");
  if (isNaN(d.getTime())) return "";
  return `${ID_DAYS[d.getDay()]} ${d.getDate()} ${ID_MONTHS[d.getMonth()]}`;
}
function firstName(name?: string | null): string {
  return (name || "mentor").trim().split(/\s+/)[0] || "mentor";
}

/** Heuristic: which pending tasks read like "please upload a document". */
const DOC_TASK_RE = /unggah|upload|kirim|lamp|cv|transkrip|ijazah|sertifikat|dokumen|esai|essay|motivation|letter|rekomendasi/i;
function taskToCategory(title: string): string {
  const t = title.toLowerCase();
  if (/\bcv\b|resume/.test(t)) return "cv";
  if (/transkrip|ijazah/.test(t)) return "transcript";
  if (/ielts|toefl|bahasa/.test(t)) return "ielts";
  if (/lpdp|beasiswa|esai|essay/.test(t)) return "essay_lpdp";
  if (/motivation|letter|ml\b/.test(t)) return "motivation_letter";
  if (/rekomendasi|recommendation/.test(t)) return "recommendation";
  if (/sertifikat|certificate/.test(t)) return "certificate";
  return "other";
}

/** Map a session doc-checklist label → a Document category (mirrors the Sesi page). */
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

// One required-document row in the recap (aggregated across all sessions).
interface RecapRow {
  name: string;
  category: string;
  sessionNums: number[];
  doc: DocRow | null;
  status: string; // doc status, or "none" when nothing uploaded yet
}

// Recap filters operate on the row status (incl. "none" = belum diunggah).
const RECAP_FILTERS: { id: string; label: string; match: (r: RecapRow) => boolean }[] = [
  { id: "all", label: "Semua", match: () => true },
  { id: "none", label: "Belum diunggah", match: (r) => r.status === "none" },
  { id: "review", label: "Ditinjau", match: (r) => r.status === "uploaded" || r.status === "under_review" },
  { id: "active", label: "Perlu revisi", match: (r) => r.status === "needs_revision" },
  { id: "done", label: "Disetujui", match: (r) => r.status === "approved" },
];

const PENDING = new Set(["pending", "in_progress", "overdue"]);

export default function DokumenPage() {
  const { user } = useUser();
  // Seed from the shared cache for instant revisit; revalidated on mount.
  const cachedPairing = getCachedMenteePairing();
  const [pairing, setPairing] = useState<Pairing | null>(
    cachedPairing !== undefined ? (cachedPairing as Pairing | null) : null,
  );
  const [loading, setLoading] = useState(cachedPairing === undefined);
  const [filter, setFilter] = useState("all");
  const [openDoc, setOpenDoc] = useState<DocRow | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null); // task id or "doc:<name>"
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ name: string; category: string; sessionNum: number | null } | null>(null);

  // Comment thread for the open document.
  const [comments, setComments] = useState<DocComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!openDoc) { setComments([]); setDraft(""); return; }
    let cancelled = false;
    setCommentsLoading(true);
    fetch(`/api/documents/${openDoc.id}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => { if (!cancelled) setComments(d.comments || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [openDoc]);

  async function postComment() {
    if (!openDoc || !draft.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/documents/${openDoc.id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comment) { setComments((prev) => [...prev, data.comment]); setDraft(""); }
    } finally {
      setPosting(false);
    }
  }

  async function load(force = false) {
    try {
      // `force` after a mutation (upload) so we never show stale docs.
      if (force) invalidateMenteePairing();
      const p = await refreshMenteePairing();
      setPairing((p as Pairing) || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const derived = useMemo(() => {
    if (!pairing) return null;
    const docs = [...(pairing.documents || [])];
    const tasks = pairing.tasks || [];
    const requests = tasks
      .filter((t) => PENDING.has(t.status) && DOC_TASK_RE.test(t.title))
      // hide a request once a matching doc exists for that category
      .filter((t) => !docs.some((d) => d.category === taskToCategory(t.title)));
    const approved = docs.filter((d) => d.status === "approved").length;
    const needsAction = docs.filter((d) => d.status === "needs_revision").length;
    const featured =
      docs.find((d) => d.status === "needs_revision") ||
      docs.find((d) => d.status === "uploaded") ||
      docs.find((d) => d.status === "under_review") ||
      null;
    const breakdown = (["needs_revision", "uploaded", "under_review", "approved"] as const)
      .map((k) => ({ k, label: statusOf(k).label, sw: statusOf(k).sw, n: docs.filter((d) => d.status === k).length }))
      .filter((b) => b.n > 0);
    return { docs, requests, approved, needsAction, featured, breakdown };
  }, [pairing]);

  // Recap of every required document across ALL (held) sessions, matched to an
  // uploaded Document where one exists. Deduped by name.
  const requiredDocs = useMemo<RecapRow[]>(() => {
    if (!pairing) return [];
    const docs = pairing.documents || [];
    const sessions = (pairing.sessions || []).filter((s) => s.enabled !== false);
    const map = new Map<string, { name: string; category: string; sessionNums: number[] }>();
    for (const s of sessions) {
      const list = Array.isArray(s.docChecklist) ? s.docChecklist : [];
      for (const raw of list) {
        const item = String(raw || "").trim();
        const key = item.toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          if (s.sessionNum != null && !existing.sessionNums.includes(s.sessionNum)) existing.sessionNums.push(s.sessionNum);
        } else {
          map.set(key, { name: item, category: docChecklistCategory(item), sessionNums: s.sessionNum != null ? [s.sessionNum] : [] });
        }
      }
    }
    const matchDoc = (name: string, cat: string): DocRow | null => {
      const q = name.toLowerCase();
      return docs.find((d) =>
        (cat !== "other" && d.category === cat) ||
        d.name.toLowerCase() === q ||
        d.name.toLowerCase().includes(q),
      ) || null;
    };
    return [...map.values()].map((r) => {
      const doc = matchDoc(r.name, r.category);
      return { ...r, doc, status: doc ? doc.status : "none" };
    });
  }, [pairing]);

  function startUpload(name: string, category: string, sessionNum: number | null, key: string) {
    pendingUpload.current = { name, category, sessionNum };
    setUploadingFor(key);
    fileRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const ctx = pendingUpload.current;
    if (!file || !ctx || !pairing) { setUploadingFor(null); return; }
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", ctx.name);
      fd.append("category", ctx.category);
      if (ctx.sessionNum != null) fd.append("sessionNum", String(ctx.sessionNum));
      const res = await fetch(`/api/pairings/${pairing.id}/documents`, { method: "POST", body: fd });
      if (res.ok) await load(true);
    } finally {
      setUploadingFor(null);
      pendingUpload.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return <SkeletonDashboard />;
  if (!pairing || !derived) {
    return (
      <EmptyState
        icon="document"
        title="Belum ada dokumen"
        description="Kamu akan dipasangkan dengan mentor sebentar lagi — dokumen aplikasimu muncul di sini."
      />
    );
  }

  const d = derived;
  const mentorFirst = firstName(pairing.mentor?.name);
  // Recap-based view: required docs across all sessions, filtered by status.
  const recapShown = requiredDocs.filter(RECAP_FILTERS.find((f) => f.id === filter)!.match);
  const totalRequired = requiredDocs.length;
  const approvedRequired = requiredDocs.filter((r) => r.status === "approved").length;

  function badge(doc: DocRow) {
    const s = statusOf(doc.status);
    return <span className={`dok-badge ${s.key}`}>● {s.label}</span>;
  }

  function RecapCard({ r }: { r: RecapRow }) {
    const v = catVisual(r.category);
    const doc = r.doc;
    const s = r.status === "none"
      ? { key: "draft" as StatusKey, label: "Belum diunggah", sw: "var(--text-muted-2)" }
      : statusOf(r.status);
    const sesLabel = r.sessionNums.length
      ? `Sesi ${[...r.sessionNums].sort((a, b) => a - b).join(", ")}`
      : "Umum";
    const key = `req:${r.name.toLowerCase()}`;
    const busy = uploadingFor === key;
    return (
      <div className="dok-doc" style={{ cursor: "default" }}>
        <span className={`dok-tile ${v.tile}`}><Icon name={v.icon} size={22} /></span>
        <div className="d-body">
          <h3 className="d-title">{r.name} <span className={`dok-badge ${s.key}`}>● {s.label}</span></h3>
          <div className="d-meta">
            {sesLabel} · {CAT_LABEL[r.category] || r.category}{doc ? ` · v${doc.version}` : ""}
          </div>
        </div>
        <div className="d-action">
          {doc ? (
            <>
              <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="db-btn db-btn-outline sm">Unduh</a>
              {r.status === "needs_revision" ? (
                <button type="button" className="db-btn db-btn-primary sm" onClick={() => startUpload(r.name, r.category, r.sessionNums[0] ?? null, key)} disabled={busy}>
                  {busy ? "Mengunggah…" : "Kirim revisi"}
                </button>
              ) : (
                <button type="button" className="db-btn db-btn-outline sm" onClick={() => setOpenDoc(doc)}>Lihat</button>
              )}
            </>
          ) : (
            <button type="button" className="db-btn db-btn-primary sm" onClick={() => startUpload(r.name, r.category, r.sessionNums[0] ?? null, key)} disabled={busy}>
              {busy ? "Mengunggah…" : "Unggah"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,image/*" style={{ display: "none" }} onChange={onFilePicked} />

      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="sesi-crumb">Dokumen</div>
          <h1 className="sesi-title">Dokumen <span className="lede">aplikasi kamu.</span></h1>
          <p className="sesi-sub">
            Semua draft di satu tempat — Motivation Letter, CV, esai beasiswa. Pantau versi dan umpan balik {mentorFirst}, lalu kirim ulang kalau sudah revisi.
          </p>
        </div>
      </div>

      <div className="dok-grid">
        <div>
          {/* Filters */}
          <div className="filter-chips" style={{ marginBottom: 18 }}>
            {RECAP_FILTERS.map((f) => {
              const n = requiredDocs.filter(f.match).length;
              return (
                <button type="button" key={f.id} className={`db-pill ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
                  {f.label} <span style={{ opacity: 0.6, fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* Continue / featured doc */}
          {d.featured && (
            <div className="today" style={{ marginBottom: 18 }}>
              <div className="today-blob" />
              <div className="today-content">
                <div className="today-head">
                  {badge(d.featured)}
                  <span className="eyebrow primary" style={{ display: "inline" }}>
                    {d.featured.status === "needs_revision" ? "Perlu kamu revisi" : "Lanjutkan dokumen ini"}
                  </span>
                </div>
                <h3 style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 21, color: "var(--primary-900)", margin: "10px 0 4px", letterSpacing: "-0.01em" }}>
                  {d.featured.name}
                </h3>
                <p className="who" style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  {CAT_LABEL[d.featured.category] || d.featured.category} · v{d.featured.version}
                  {d.featured.feedback ? ` · ada catatan dari ${mentorFirst}` : ""}
                </p>
                {d.featured.targetWords != null && d.featured.targetWords > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 0" }}>
                    <div className="dok-track-lg" style={{ flex: 1, maxWidth: 420, margin: 0 }}>
                      <i style={{ width: `${Math.min(100, Math.round(((d.featured.wordCount ?? 0) / d.featured.targetWords) * 100))}%` }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--text-muted-3)", whiteSpace: "nowrap" }}>
                      <b style={{ color: "var(--primary-900)" }}>{d.featured.wordCount ?? 0}</b> / {d.featured.targetWords} kata
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <button type="button" className="db-btn db-btn-primary sm" onClick={() => setOpenDoc(d.featured)}>
                    {d.featured.feedback ? `Lihat catatan ${mentorFirst}` : "Buka dokumen"}
                  </button>
                  {d.featured.status === "needs_revision" && (
                    <button type="button" className="db-btn db-btn-outline sm" onClick={() => startUpload(d.featured!.name, d.featured!.category, d.featured!.sessionNum ?? null, `doc:${d.featured!.id}`)}>
                      Kirim revisi
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Requested nudge (top one) */}
          {d.requests.length > 0 && (
            <div className="today-warn" style={{ marginBottom: 26 }}>
              <span className="ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
              </span>
              <span><b>{mentorFirst} minta {d.requests[0].title}</b>{d.requests[0].dueDate ? ` · jatuh tempo ${fmtDate(d.requests[0].dueDate)}` : ""}. Unggah biar bisa ditinjau sebelum sesi.</span>
              <button type="button" className="nudge" style={{ marginLeft: "auto", background: "transparent", border: 0, cursor: "pointer" }}
                onClick={() => startUpload(d.requests[0].title, taskToCategory(d.requests[0].title), d.requests[0].sessionNum ?? null, d.requests[0].id)}>
                {uploadingFor === d.requests[0].id ? "Mengunggah…" : "Unggah sekarang"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
              </button>
            </div>
          )}

          <div className="section-head" style={{ marginBottom: 12 }}><h2 style={{ fontSize: 17 }}>Dokumen yang diperlukan</h2><span className="meta">{approvedRequired} / {totalRequired} disetujui</span></div>
          <div className="dok-list">
            {totalRequired === 0 ? (
              <div className="dok-doc" style={{ justifyContent: "center", color: "var(--text-muted)", cursor: "default" }}>
                Belum ada dokumen yang diminta. Daftar muncul begitu rencana sesi kamu difinalisasi.
              </div>
            ) : recapShown.length === 0 ? (
              <div className="dok-doc" style={{ justifyContent: "center", color: "var(--text-muted)", cursor: "default" }}>
                Tidak ada dokumen untuk filter ini.
              </div>
            ) : (
              recapShown.map((r) => <RecapCard key={r.name} r={r} />)
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside>
          <div className="side-card" style={{ padding: 20 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 12 }}>Kesiapan dokumen</span>
            <div className="dok-prog-num">{approvedRequired} <span className="of">/ {totalRequired || 0} disetujui</span></div>
            <div className="dok-track-lg"><i style={{ width: `${totalRequired ? Math.round((approvedRequired / totalRequired) * 100) : 0}%` }} /></div>
            {d.breakdown.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--text-muted-2)", margin: 0 }}>Belum ada dokumen yang diunggah.</p>
            ) : (
              d.breakdown.map((b) => (
                <div className="dok-st-row" key={b.k}>
                  <span className="sw" style={{ background: b.sw }} /><span>{b.label}</span><span className="n">{b.n}</span>
                </div>
              ))
            )}
          </div>

          <div className="side-card" style={{ padding: 20 }}>
            <span className="eyebrow" style={{ display: "block", marginBottom: 12 }}>Diminta {mentorFirst}</span>
            {d.requests.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                Tidak ada permintaan terbuka. Semua dokumen yang diminta {mentorFirst} sudah kamu kirim.
              </p>
            ) : (
              d.requests.map((t) => (
                <div className="dok-req-item" key={t.id}>
                  <span className="ri-tile"><Icon name={catVisual(taskToCategory(t.title)).icon} size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="ri-name">{t.title}</div>
                    <div className="ri-meta">{t.dueDate ? `jatuh tempo ${fmtDate(t.dueDate)}` : "diminta mentor"}</div>
                  </div>
                  <button type="button" className="ri-up" onClick={() => startUpload(t.title, taskToCategory(t.title), t.sessionNum ?? null, t.id)} disabled={uploadingFor === t.id}>
                    {uploadingFor === t.id ? "…" : "Unggah"}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="side-card tip" style={{ padding: 20 }}>
            <span className="tag">Catatan {mentorFirst}</span>
            <h4>Draft kasar lebih awal &gt; draft sempurna telat.</h4>
            <p>Kirim versi awal walau belum rapi — lebih baik dapat arah di v1 daripada kamu sempurnakan sendiri ke arah yang salah. Revisi itu bagian dari proses.</p>
          </div>
        </aside>
      </div>

      {/* Detail modal */}
      <Modal
        open={!!openDoc}
        onClose={() => setOpenDoc(null)}
        title={openDoc?.name || "Dokumen"}
        description={openDoc ? `${CAT_LABEL[openDoc.category] || openDoc.category} · v${openDoc.version}` : ""}
        size="lg"
        actions={
          openDoc ? (
            <>
              {openDoc.filePath && (
                <a href={openDoc.filePath} target="_blank" rel="noopener noreferrer" className="db-btn db-btn-outline">Unduh / buka file</a>
              )}
              {openDoc.status === "needs_revision" ? (
                <button type="button" className="db-btn db-btn-primary" onClick={() => { const doc = openDoc; setOpenDoc(null); startUpload(doc.name, doc.category, doc.sessionNum ?? null, `doc:${doc.id}`); }}>
                  Kirim revisi
                </button>
              ) : (
                <button type="button" className="db-btn db-btn-primary" onClick={() => setOpenDoc(null)}>Tutup</button>
              )}
            </>
          ) : null
        }
      >
        {openDoc && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              {badge(openDoc)}
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {openDoc.updatedAt ? `diperbarui ${fmtDate(openDoc.updatedAt)}` : ""}
              </span>
            </div>

            <div style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted-2)", marginBottom: 12 }}>
              Catatan & diskusi
            </div>
            {(() => {
              const initials = (n?: string | null) => (n || "M").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              // Legacy single-feedback string shows as a mentor comment when no
              // thread exists yet — so older docs aren't blank.
              const legacy = (!commentsLoading && comments.length === 0 && openDoc.feedback && openDoc.feedback.trim())
                ? [{ id: "legacy", body: openDoc.feedback, suggestedQuote: null, createdAt: openDoc.updatedAt || openDoc.createdAt || "", author: pairing.mentor ? { id: pairing.mentor.id, name: pairing.mentor.name, role: "mentor" } : null }]
                : [];
              const thread = comments.length > 0 ? comments : legacy;
              if (commentsLoading) return <p style={{ fontSize: 13, color: "var(--text-muted-2)", margin: 0 }}>Memuat catatan…</p>;
              if (thread.length === 0) {
                return <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                  {openDoc.status === "under_review" ? `Belum ada catatan — ${mentorFirst} sedang meninjau dokumen kamu.` : "Belum ada catatan. Mulai diskusi di bawah."}
                </p>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {thread.map((c) => {
                    const isMentor = c.author?.role !== "mentee";
                    return (
                      <div key={c.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                        <span className={`av-grad sm ${isMentor ? "av-c5" : "av-c1"}`}>{initials(c.author?.name)}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "var(--font-poppins)", fontWeight: 600, fontSize: 13, color: "var(--primary-900)" }}>{c.author?.name || "Mentor"}</span>
                            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--text-muted-2)" }}>{fmtDate(c.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text-muted-3)", lineHeight: 1.55, marginTop: 5, whiteSpace: "pre-wrap" }}>{c.body}</div>
                          {c.suggestedQuote && (
                            <div style={{ fontStyle: "italic", color: "var(--primary-700)", borderLeft: "2px solid var(--primary-200)", paddingLeft: 10, margin: "8px 0 0", fontSize: 12.5 }}>{c.suggestedQuote}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Compose */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                className="sb-input"
                style={{ flex: 1, fontSize: 13, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--foreground)" }}
                placeholder={`Tulis catatan untuk ${mentorFirst}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
              />
              <button type="button" className="db-btn db-btn-primary sm" onClick={postComment} disabled={posting || !draft.trim()}>
                {posting ? "…" : "Kirim"}
              </button>
            </div>

            <div style={{ fontFamily: "var(--font-poppins)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted-2)", margin: "22px 0 12px" }}>
              Versi
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: "var(--primary-900)", fontFamily: "var(--font-poppins)" }}>v{openDoc.version}</span>
              <span style={{ color: "var(--text-muted)" }}>{openDoc.fileName}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--text-muted-2)" }}>{fmtDate(openDoc.updatedAt || openDoc.createdAt)}</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
