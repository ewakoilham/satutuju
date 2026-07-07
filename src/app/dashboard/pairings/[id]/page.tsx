"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import { toast } from "@/lib/toast";
import Select from "@/components/ui/Select";
import { CURRICULUM, DOCUMENT_CATEGORIES } from "@/lib/curriculum";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { ConfirmModal } from "@/components/ui/Modal";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { cleanUniName } from "@/data/university-enrichment";

interface Session {
  id: string;
  sessionNum: number;
  phase: string;
  topic: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  mentorRating?: number;
  menteeEnergy?: number;
  keyOutput?: string;
  obstacles?: string;
  summaryNotes?: string;
  menteeFeedback?: string;
}

interface Doc {
  id: string;
  category: string;
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  status: string;
  version: number;
  feedback?: string;
  createdAt: string;
}

interface Task {
  id: string;
  sessionNum?: number;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
}

interface Pairing {
  id: string;
  status: string;
  targetProgram?: string;
  priorityUnis?: string;
  ieltsScore?: string;
  mentor: { id: string; name: string; email: string; avatar?: string | null };
  menteeProfile?: { fullLegalName?: string | null } | null;
  mentee: { id: string; name: string; email: string; avatar?: string | null };
  sessions: Session[];
  documents: Doc[];
  tasks: Task[];
}

type Tab = "sessions" | "documents" | "tasks";

function getDocUrl(doc: Doc) {
  // If filePath is already a full URL (Supabase Storage), use it directly
  if (doc.filePath.startsWith("http")) return doc.filePath;
  // Legacy local path fallback
  return `/api/uploads/${doc.filePath.replace(/^\/?uploads\//, "")}`;
}

function getFileExt(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function isPreviewable(fileName: string) {
  const ext = getFileExt(fileName);
  return ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
}

function isOfficeFile(fileName: string) {
  const ext = getFileExt(fileName);
  return ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
}

function isImageFile(fileName: string) {
  const ext = getFileExt(fileName);
  return ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
}

export default function PairingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const router = useRouter();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [tab, setTab] = useState<Tab>("sessions");
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const fetchPairing = useCallback(async () => {
    const res = await fetch(`/api/pairings/${id}`);
    if (!res.ok) {
      router.push("/dashboard");
      return;
    }
    const data = await res.json();
    setPairing(data.pairing);
    setLoading(false);
  }, [id, router]);

  // Admin action states (must be before early return)
  const [showReplaceMentor, setShowReplaceMentor] = useState(false);
  const [allMentors, setAllMentors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [newMentorId, setNewMentorId] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetchPairing();
  }, [fetchPairing]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/users?role=mentor").then(r => r.json()).then(d => setAllMentors(d.users || []));
    }
  }, [isAdmin]);

  // Mentors skip this legacy list view entirely — go straight to the
  // redesigned Sesi page (its "Semua sesi" rail already covers the whole
  // session list). Admins keep this page for pairing management.
  useEffect(() => {
    // Both mentor AND mentee get the redesigned Sesi page (its "Semua sesi"
    // rail covers the whole list). Only admins stay on this management view.
    if (loading || !pairing || !user || user.role === "admin") return;
    const list = [...pairing.sessions].sort((a, b) => a.sessionNum - b.sessionNum);
    const target = list.find((s) => s.status !== "completed") ?? list[0];
    if (target) router.replace(`/dashboard/sesi/${target.id}`);
  }, [loading, pairing, user, router]);

  if (loading || !pairing || !user) {
    return <SkeletonDashboard />;
  }

  // While the redirect above is in flight (mentor/mentee), don't flash the old list.
  if (user.role !== "admin" && pairing.sessions.length > 0) {
    return <SkeletonDashboard />;
  }

  const isMentor = user.role === "mentor" || user.role === "admin";
  const completed = pairing.sessions.filter(
    (s) => s.status === "completed"
  ).length;

  async function handleReplaceMentor() {
    if (!newMentorId) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch(`/api/pairings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId: newMentorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengganti mentor.");
      } else {
        setShowReplaceMentor(false);
        setNewMentorId("");
        fetchPairing();
      }
    } catch {
      toast.error("Jaringan bermasalah — coba lagi.");
    }
    setAdminActionLoading(false);
  }

  async function handleRemovePairing() {
    if (!pairing) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch(`/api/pairings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal membatalkan pairing.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      toast.error("Jaringan bermasalah — coba lagi.");
    }
    setAdminActionLoading(false);
    setShowRemoveConfirm(false);
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "sessions", label: "Sessions", count: completed },
    { key: "documents", label: "Documents", count: pairing.documents.length },
    { key: "tasks", label: "Tasks", count: pairing.tasks.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-text-muted-2 hover:text-foreground mb-2 inline-flex items-center gap-1"
          >
            <Icon name="arrow-left" size={14} />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">
            <span className="flex items-center gap-3">
              <Avatar name={pairing.mentee.name} size="md" src={pairing.mentee.avatar || undefined} />
              {pairing.mentee.name}
              <span className="text-text-muted-2 font-normal text-lg">
                &times;
              </span>
              <Avatar name={pairing.mentor.name} size="md" src={pairing.mentor.avatar || undefined} />
              <span className="text-text-muted-2 font-normal text-lg">
                {pairing.mentor.name}
              </span>
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {pairing.targetProgram && (
              <span className="text-sm text-primary font-medium bg-primary-50 px-2.5 py-1 rounded-lg">
                {pairing.targetProgram}
              </span>
            )}
            {isMentor && (
              <button
                onClick={() => router.push(`/dashboard/profile/${pairing.mentee.id}`)}
                className="group relative p-2 rounded-lg bg-brand-blue-soft/50 hover:bg-brand-blue-soft text-primary transition"
                aria-label="View Mentee Profile"
              >
                <Icon name="user" size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-surface-elevated rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  View Mentee Profile
                </span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push(`/dashboard/mentor-profile/${pairing.mentor.id}`)}
                className="group relative p-2 rounded-lg bg-brand-lavender/30 hover:bg-brand-lavender/60 text-primary-700 transition"
                aria-label="View Mentor Profile"
              >
                <Icon name="graduation" size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-surface-elevated rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                  View Mentor Profile
                </span>
              </button>
            )}
            {isAdmin && pairing.status !== "cancelled" && (
              <>
                {showReplaceMentor ? (
                  <div className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2">
                    <Select
                      value={newMentorId}
                      onChange={(v) => setNewMentorId(v)}
                      options={[
                        { value: "", label: "Select new mentor..." },
                        ...allMentors.filter((m) => m.id !== pairing.mentor.id).map((m) => ({
                          value: m.id,
                          label: `${m.name} (${m.email})`,
                        })),
                      ]}
                      className="text-sm"
                    />
                    <button
                      onClick={handleReplaceMentor}
                      disabled={!newMentorId || adminActionLoading}
                      className="text-sm bg-primary text-white px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {adminActionLoading ? "..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => { setShowReplaceMentor(false); setNewMentorId(""); }}
                      className="text-sm text-text-muted-2 hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReplaceMentor(true)}
                    className="group relative p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition"
                    aria-label="Replace Mentor"
                  >
                    <Icon name="refresh" size={16} />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-surface-elevated rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                      Replace Mentor
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  disabled={adminActionLoading}
                  className="group relative p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition disabled:opacity-50"
                  aria-label="Remove Pairing"
                >
                  <Icon name="trash" size={16} />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs font-medium text-white bg-surface-elevated rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                    Remove Pairing
                  </span>
                </button>
              </>
            )}
          </div>
          {pairing.status === "cancelled" && (
            <Badge variant="danger" className="mt-2">Cancelled</Badge>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-text-muted">Progress</div>
          <div className="text-2xl font-bold text-primary">
            {completed}/10
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar value={(completed / 10) * 100} size="lg" />

      {/* Shortlist kampus — the mentee's favorited campuses (Pairing.priorityUnis,
          set by the mentee on /dashboard/universities). Read-only here. */}
      {(() => {
        let shortlist: string[] = [];
        try {
          const v = JSON.parse(pairing.priorityUnis || "[]");
          if (Array.isArray(v)) shortlist = v.filter((x): x is string => typeof x === "string");
        } catch { /* ignore malformed */ }
        if (shortlist.length === 0) return null;
        const menteeFirst = pairing.mentee.name.split(/\s+/)[0];
        return (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name="school" size={18} className="text-primary" />
                Shortlist kampus {menteeFirst}
              </h3>
              <span className="text-xs text-text-muted-2 whitespace-nowrap">{shortlist.length} kampus</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {shortlist.map((name, i) => (
                <span key={i} className="text-sm bg-primary-50 text-primary-700 border border-primary-100 rounded-lg px-3 py-1.5">
                  {cleanUniName(name)}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-3">
              Kampus favorit yang {menteeFirst} simpan di tab Kampus. Pakai ini buat arahkan strategi aplikasi.
            </p>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="bg-surface-elevated p-1 rounded-xl inline-flex">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              tab === t.key
                ? "bg-surface text-primary shadow-sm"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 text-xs rounded-full px-2 py-0.5 ${
                tab === t.key ? "bg-primary/10 text-primary" : "bg-surface-elevated text-text-muted"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "sessions" && (
        <SessionsTab
          sessions={pairing.sessions}
          documents={pairing.documents}
          pairingId={pairing.id}
          isMentor={isMentor}
          onRefresh={fetchPairing}
          onPreview={setPreviewDoc}
        />
      )}
      {tab === "documents" && (
        <DocumentsTab
          pairingId={pairing.id}
          menteeName={pairing.menteeProfile?.fullLegalName || pairing.mentee.name}
          isAdmin={user?.role === "admin"}
          isMentor={isMentor}
          onRefresh={fetchPairing}
          onPreview={setPreviewDoc}
        />
      )}
      {tab === "tasks" && (
        <TasksTab
          tasks={pairing.tasks}
          pairingId={pairing.id}
          isMentor={isMentor}
          onRefresh={fetchPairing}
        />
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm">{previewDoc.name}</h3>
                <p className="text-xs text-text-muted-2 mt-0.5">
                  {previewDoc.fileName} &middot; {(previewDoc.fileSize / 1024).toFixed(0)} KB &middot; v{previewDoc.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${getDocUrl(previewDoc)}?download=1`}
                  className="inline-flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                >
                  <Icon name="download" size={16} />
                  Download
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-text-muted-2 hover:text-foreground p-2 rounded-lg hover:bg-surface-elevated transition"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-auto p-6 bg-surface-elevated min-h-[400px]">
              {isOfficeFile(previewDoc.fileName) ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(window.location.origin + getDocUrl(previewDoc))}&embedded=true`}
                  className="w-full h-full min-h-[500px] rounded-lg border border-border bg-surface"
                />
              ) : getFileExt(previewDoc.fileName) === "pdf" ? (
                <iframe
                  src={getDocUrl(previewDoc)}
                  className="w-full h-full min-h-[500px] rounded-lg border border-border"
                />
              ) : isImageFile(previewDoc.fileName) ? (
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getDocUrl(previewDoc)}
                    alt={previewDoc.name}
                    className="max-w-full max-h-[70vh] rounded-lg shadow-sm"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-text-muted-2">
                  <Icon name="document" size={48} className="mb-4 text-text-muted-2" />
                  <p className="text-sm font-medium mb-1">Preview not available for this file type</p>
                  <p className="text-xs">Click Download to view the file</p>
                </div>
              )}
            </div>
            {/* Feedback if any */}
            {previewDoc.feedback && (
              <div className="px-6 py-3 border-t border-border bg-surface-amber">
                <p className="text-xs font-medium text-text-muted mb-1">Mentor Feedback</p>
                <p className="text-sm text-foreground">{previewDoc.feedback}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Remove Pairing Modal */}
      <ConfirmModal
        open={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemovePairing}
        title="Remove Pairing"
        description={`Cancel the pairing between ${pairing.mentor.name} and ${pairing.mentee.name}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={adminActionLoading}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// SESSIONS TAB
// ─────────────────────────────────────────────

function SessionsTab({
  sessions,
  documents,
  pairingId,
  isMentor,
  onRefresh,
  onPreview,
}: {
  sessions: Session[];
  documents: Doc[];
  pairingId: string;
  isMentor: boolean;
  onRefresh: () => void;
  onPreview: (doc: Doc) => void;
}) {
  const router = useRouter();
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  const PHASE_STYLES: Record<string, string> = {
    discovery: "border-l-blue-500",
    planning: "border-l-amber-500",
    writing: "border-l-purple-500",
    execution: "border-l-orange-500",
    closing: "border-l-green-500",
  };

  const STATUS_BORDER: Record<string, string> = {
    completed: "border-l-green-500",
    scheduled: "border-l-blue-500",
    upcoming: "border-l-border",
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const template = CURRICULUM[session.sessionNum - 1];
        const isExpanded = expandedSession === session.sessionNum;
        const missingDocs =
          session.status === "completed" &&
          template?.docChecklist?.length > 0 &&
          template.docChecklist.some(
            (item) => findMatchingDocs(item, documents).length === 0
          );

        return (
          <div
            key={session.id}
            className={`card card-hover border-l-4 ${
              STATUS_BORDER[session.status] || PHASE_STYLES[session.phase] || "border-l-border"
            } overflow-hidden !p-0`}
          >
            <div
              className="px-6 py-4 cursor-pointer flex items-center justify-between"
              onClick={() => router.push(`/dashboard/sesi/${session.id}`)}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    session.status === "completed"
                      ? "bg-surface-green text-text-green"
                      : "bg-surface-elevated text-text-muted"
                  }`}
                >
                  {session.status === "completed" ? (
                    <Icon name="check" size={16} />
                  ) : (
                    session.sessionNum
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{session.topic}</p>
                  <p className="text-xs text-text-muted-2 capitalize flex items-center gap-1">
                    {session.phase} &middot; {template?.duration || 75} min
                    {session.scheduledAt && (
                      <>
                        {" "}&middot;{" "}
                        <Icon name="calendar" size={12} className="inline" />
                        {new Date(session.scheduledAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {session.menteeEnergy && (
                  <Badge
                    variant={
                      session.menteeEnergy <= 2
                        ? "danger"
                        : session.menteeEnergy <= 3
                        ? "warning"
                        : "success"
                    }
                  >
                    Energy: {session.menteeEnergy}/5
                  </Badge>
                )}
                <Badge
                  variant={
                    missingDocs
                      ? "warning"
                      : session.status === "completed"
                      ? "success"
                      : session.status === "scheduled"
                      ? "info"
                      : "neutral"
                  }
                >
                  {missingDocs ? "missing documents" : session.status}
                </Badge>
                <button
                  type="button"
                  title={isExpanded ? "Tutup ringkasan" : "Ringkasan cepat (buka halaman sesi untuk detail)"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSession(isExpanded ? null : session.sessionNum);
                  }}
                  className="text-text-muted-2 hover:text-foreground p-1 -m-1 rounded"
                >
                  <Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={16} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <SessionDetail
                session={session}
                template={template}
                documents={documents}
                pairingId={pairingId}
                isMentor={isMentor}
                onRefresh={onRefresh}
                onPreview={onPreview}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PHASE_CURRICULUM_COLORS: Record<string, { bg: string; border: string; text: string; icon: string; badge: "info" | "warning" | "primary" | "danger" | "success" }> = {
  discovery: { bg: "bg-surface-blue", border: "border-surface-blue-border", text: "text-text-blue", icon: "text-text-blue", badge: "info" },
  planning: { bg: "bg-surface-amber", border: "border-surface-amber-border", text: "text-text-amber", icon: "text-text-amber", badge: "warning" },
  writing: { bg: "bg-surface-purple", border: "border-surface-purple-border", text: "text-text-purple", icon: "text-text-purple", badge: "primary" },
  execution: { bg: "bg-surface-orange", border: "border-surface-orange-border", text: "text-text-orange", icon: "text-text-orange", badge: "danger" },
  closing: { bg: "bg-surface-green", border: "border-surface-green-border", text: "text-text-green", icon: "text-text-green", badge: "success" },
};

// Maps curriculum doc checklist keywords to document categories
// Only map keywords to specific (non-generic) categories.
// "other" is intentionally excluded — it matches too broadly.
const DOC_CHECKLIST_MATCH: Record<string, string[]> = {
  "cv": ["cv"],
  "resume": ["cv"],
  "academic cv": ["cv"],
  "transcript": ["transcript"],
  "language test": ["ielts"],
  "ielts": ["ielts"],
  "toefl": ["ielts"],
  "motivation letter": ["motivation_letter"],
  "ml": ["motivation_letter"],
  "ps": ["motivation_letter"],
  "lpdp": ["essay_lpdp"],
  "essay": ["essay_lpdp"],
  "certificate": ["certificate"],
  "recommendation": ["recommendation"],
};

function guessCategory(checklistItem: string): string {
  const lower = checklistItem.toLowerCase();
  for (const [keyword, categories] of Object.entries(DOC_CHECKLIST_MATCH)) {
    if (lower.includes(keyword)) return categories[0];
  }
  return "other";
}

function findMatchingDocs(checklistItem: string, documents: Doc[]): Doc[] {
  const lower = checklistItem.toLowerCase();

  // 1. Exact name match (session deliverables are always uploaded with exact checklist item name)
  const exactMatch = documents.filter((d) => d.name.toLowerCase() === lower);
  if (exactMatch.length > 0) return exactMatch;

  // 2. Category match (reliable for known document types — cv, transcript, ielts, etc.)
  for (const [keyword, categories] of Object.entries(DOC_CHECKLIST_MATCH)) {
    if (lower.includes(keyword)) {
      const catMatch = documents.filter((d) => categories.includes(d.category));
      if (catMatch.length > 0) return catMatch;
      // keyword matched but no docs in that category — stop here, don't fall to name match
      break;
    }
  }

  // 3. Whole-word AND match: every meaningful word in the checklist item must appear
  //    as a whole word in the doc name. Prevents "University wish list" matching
  //    "University shortlist document" (different items from different sessions).
  const words = lower.split(/[\s\/\(\)\-]+/).filter((w) => w.length > 3);
  if (words.length > 0) {
    const nameMatch = documents.filter((d) => {
      const docWords = d.name.toLowerCase().split(/[\s\/\(\)\-]+/);
      return words.every((w) => docWords.includes(w));
    });
    if (nameMatch.length > 0) return nameMatch;
  }

  return [];
}

function SessionDetail({
  session,
  template,
  documents,
  pairingId,
  isMentor,
  onRefresh,
  onPreview,
}: {
  session: Session;
  template: (typeof CURRICULUM)[0];
  documents: Doc[];
  pairingId: string;
  isMentor: boolean;
  onRefresh: () => void;
  onPreview: (doc: Doc) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: session.status,
    mentorRating: session.mentorRating || 0,
    menteeEnergy: session.menteeEnergy || 0,
    keyOutput: session.keyOutput || "",
    obstacles: session.obstacles || "",
    summaryNotes: session.summaryNotes || "",
    scheduledAt: session.scheduledAt
      ? new Date(session.scheduledAt).toISOString().slice(0, 16)
      : "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(
      `/api/pairings/${pairingId}/sessions/${session.sessionNum}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mentorRating: form.mentorRating || undefined,
          menteeEnergy: form.menteeEnergy || undefined,
          scheduledAt: form.scheduledAt || undefined,
        }),
      }
    );
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  const hasResults = session.summaryNotes || session.keyOutput || session.mentorRating || session.menteeEnergy;
  const [showCurriculum, setShowCurriculum] = useState(false);

  return (
    <div className="px-6 pb-6 border-t border-border pt-4 space-y-4">
      {/* SESSION RESULTS -- always shown first */}
      {hasResults && !editing ? (
        <div className="space-y-4">
          {/* Info cards */}
          <div className={`grid gap-3 ${isMentor ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
            <div className="card bg-surface-elevated !p-3 text-center">
              <p className="text-xs text-text-muted-2 mb-1">Status</p>
              <p className={`text-sm font-semibold capitalize ${
                session.status === "completed" ? "text-green-600" : "text-text-muted-3"
              }`}>{session.status}</p>
            </div>
            {isMentor && (
              <div className="card bg-surface-elevated !p-3 text-center">
                <p className="text-xs text-text-muted-2 mb-1">Mentor Rating</p>
                <p className="text-sm font-semibold">
                  {session.mentorRating ? (
                    <span className="flex items-center justify-center gap-1">
                      <Icon name="star" size={14} className="text-brand-yellow" />
                      {session.mentorRating}/5
                    </span>
                  ) : "---"}
                </p>
              </div>
            )}
            {isMentor && (
              <div className={`card !p-3 text-center ${
                session.menteeEnergy && session.menteeEnergy <= 2
                  ? "bg-surface-red"
                  : session.menteeEnergy && session.menteeEnergy <= 3
                  ? "bg-surface-amber"
                  : "bg-surface-elevated"
              }`}>
                <p className="text-xs text-text-muted-2 mb-1">Mentee Energy</p>
                <p className={`text-sm font-semibold ${
                  session.menteeEnergy && session.menteeEnergy <= 2
                    ? "text-danger"
                    : session.menteeEnergy && session.menteeEnergy <= 3
                    ? "text-amber-600"
                    : ""
                }`}>
                  {session.menteeEnergy ? `${session.menteeEnergy}/5` : "---"}
                </p>
              </div>
            )}
            <div className="card bg-surface-elevated !p-3 text-center">
              <p className="text-xs text-text-muted-2 mb-1">Completed</p>
              <p className="text-sm font-semibold flex items-center justify-center gap-1">
                <Icon name="calendar" size={14} className="text-text-muted-2" />
                {session.completedAt
                  ? new Date(session.completedAt).toLocaleDateString()
                  : "---"}
              </p>
            </div>
          </div>

          {/* Topic of Discussion */}
          {session.keyOutput && (
            <div className="bg-surface-green border border-surface-green-border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-text-green uppercase mb-1">
                Topic of Discussion
              </h4>
              <p className="text-sm text-foreground">{session.keyOutput}</p>
            </div>
          )}

          {/* Session Summary */}
          {session.summaryNotes && (
            <div className="bg-surface-amber border border-surface-amber-border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-text-amber uppercase mb-1">
                Session Summary
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {session.summaryNotes}
              </p>
            </div>
          )}

          {/* Obstacles -- mentor/admin only */}
          {isMentor && session.obstacles && (
            <div className="bg-surface-red border border-surface-red-border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-text-red uppercase mb-1">
                Obstacles / Concerns
              </h4>
              <p className="text-sm text-foreground">{session.obstacles}</p>
            </div>
          )}

          {/* Mentee feedback -- visible to mentor/admin */}
          {isMentor && session.menteeFeedback && (
            <div className="bg-surface-purple border border-surface-purple-border rounded-lg p-4">
              <h4 className="text-xs font-semibold text-text-purple uppercase mb-1">
                Mentee Feedback
              </h4>
              <p className="text-sm text-foreground whitespace-pre-wrap">{session.menteeFeedback}</p>
              {session.mentorRating && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-text-muted-2">Rating:</span>
                  <span className="text-sm flex gap-0.5">
                    {Array.from({ length: session.mentorRating }, (_, i) => (
                      <Icon key={i} name="star" size={14} className="text-brand-yellow" />
                    ))}
                  </span>
                  <span className="text-xs text-purple-600 font-medium">{session.mentorRating}/5</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : !editing ? (
        <div className="card bg-surface-elevated text-center">
          <p className="text-sm text-text-muted-2">
            No session results yet. {isMentor ? "Click \"Edit session details\" to log results after the session." : "Your mentor will log results after the session."}
          </p>
        </div>
      ) : null}

      {/* Session Deliverables -- links doc checklist to actual uploads */}
      {template.docChecklist.length > 0 && (
        <DeliverablesList
          checklist={template.docChecklist}
          documents={documents}
          pairingId={pairingId}
          isMentor={isMentor}
          onPreview={onPreview}
          onRefresh={onRefresh}
        />
      )}

      {isMentor && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          {hasResults ? "Edit session results" : "Log session results"}
        </button>
      )}

      {/* Mentee-only: Rate & give feedback */}
      {!isMentor && session.status === "completed" && (
        <MenteeFeedback
          currentRating={session.mentorRating || 0}
          currentFeedback={session.menteeFeedback || ""}
          pairingId={pairingId}
          sessionNum={session.sessionNum}
          onRefresh={onRefresh}
        />
      )}

      {/* Curriculum reference -- collapsible, mentor/admin only */}
      {isMentor && (() => {
        const phaseColors = PHASE_CURRICULUM_COLORS[template.phase] || PHASE_CURRICULUM_COLORS.discovery;
        return (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowCurriculum(!showCurriculum)}
              className={`text-sm font-medium flex items-center gap-2 ${phaseColors.text} hover:opacity-80 transition`}
            >
              <Icon name="book" size={16} />
              <span>Curriculum Guide</span>
              <Badge variant={phaseColors.badge}>{template.phaseLabel}</Badge>
              <Icon name={showCurriculum ? "chevron-down" : "chevron-right"} size={14} className="ml-auto" />
            </button>

            {showCurriculum && (
              <div className={`mt-3 ${phaseColors.bg} ${phaseColors.border} border rounded-xl p-4 relative overflow-hidden animate-slide-in-up`}>
                <Image src="/illustrations/open-book.png" alt="" width={90} height={90} className="absolute bottom-2 right-2 opacity-[0.07] pointer-events-none" />
                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-2 flex items-center gap-1.5 ${phaseColors.text}`}>
                      <Icon name="lightbulb" size={13} className={phaseColors.icon} />
                      Objective
                    </h4>
                    <p className="text-sm text-foreground">{template.objective}</p>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-2 flex items-center gap-1.5 ${phaseColors.text}`}>
                      <Icon name="clipboard-check" size={13} className={phaseColors.icon} />
                      Deliverables
                    </h4>
                    <ul className="text-sm text-foreground space-y-1">
                      {template.deliverables.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Icon name="check" size={12} className={`${phaseColors.icon} mt-0.5 flex-shrink-0`} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-2 flex items-center gap-1.5 ${phaseColors.text}`}>
                      <Icon name="user" size={13} className={phaseColors.icon} />
                      Mentee Preparation
                    </h4>
                    <ul className="text-sm text-foreground space-y-1">
                      {template.menteePrep.map((p, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Icon name="check" size={12} className={`${phaseColors.icon} mt-0.5 flex-shrink-0`} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold uppercase mb-2 flex items-center gap-1.5 ${phaseColors.text}`}>
                      <Icon name="document" size={13} className={phaseColors.icon} />
                      Document Checklist
                    </h4>
                    <ul className="text-sm text-foreground space-y-1">
                      {template.docChecklist.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Icon name="check" size={12} className={`${phaseColors.icon} mt-0.5 flex-shrink-0`} />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {editing && (
        <div className="space-y-4 card bg-surface-elevated">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Status
              </label>
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "scheduled", label: "Scheduled" },
                  { value: "completed", label: "Completed" },
                  { value: "skipped", label: "Skipped" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Scheduled
              </label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) =>
                  setForm({ ...form, scheduledAt: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Mentee Energy (1-5)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.menteeEnergy || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    menteeEnergy: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Topic of Discussion
            </label>
            <input
              type="text"
              value={form.keyOutput}
              onChange={(e) =>
                setForm({ ...form, keyOutput: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="What was discussed in this session?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Obstacles / Notes
            </label>
            <input
              type="text"
              value={form.obstacles}
              onChange={(e) =>
                setForm({ ...form, obstacles: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Any obstacles or concerns?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Session Summary (sent to mentee)
            </label>
            <textarea
              value={form.summaryNotes}
              onChange={(e) =>
                setForm({ ...form, summaryNotes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="1. What we achieved today&#10;2. Homework before next session&#10;3. When is next session"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg text-sm text-text-muted-3 hover:bg-surface-elevated"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DELIVERABLES LIST (with inline upload)
// ─────────────────────────────────────────────

function DeliverablesList({
  checklist,
  documents,
  pairingId,
  isMentor,
  onPreview,
  onRefresh,
}: {
  checklist: string[];
  documents: Doc[];
  pairingId: string;
  isMentor: boolean;
  onPreview: (doc: Doc) => void;
  onRefresh: () => void;
}) {
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Doc | null>(null);

  async function handleUpload(file: File, checklistItem: string) {
    setUploadingItem(checklistItem);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", checklistItem);
    formData.append("category", guessCategory(checklistItem));
    await fetch(`/api/pairings/${pairingId}/documents`, { method: "POST", body: formData });
    setUploadingItem(null);
    onRefresh();
  }

  async function handleReplace(file: File, doc: Doc) {
    setUploadingItem(doc.name);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", doc.name);
    formData.append("category", doc.category);
    await fetch(`/api/pairings/${pairingId}/documents`, { method: "POST", body: formData });
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setUploadingItem(null);
    onRefresh();
  }

  // Mentor / admin review: approve or request a revision.
  async function setDocStatus(doc: Doc, status: "approved" | "needs_revision") {
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  async function handleDelete(doc: Doc) {
    setDeletingDocId(doc.id);
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setDeletingDocId(null);
    setDeleteConfirm(null);
    onRefresh();
  }

  return (
    <div className="card">
      <h4 className="text-xs font-semibold text-text-muted uppercase mb-3">
        Session Deliverables
      </h4>
      <div className="space-y-2">
        {checklist.map((item, i) => {
          const matched = findMatchingDocs(item, documents);
          const isUploading = uploadingItem === item;
          return (
            <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  matched.some((d) => d.status === "approved")
                    ? "bg-surface-green text-text-green"
                    : matched.length > 0
                    ? "bg-surface-blue text-text-blue"
                    : "bg-surface-elevated text-text-muted-2"
                }`}>
                  {matched.some((d) => d.status === "approved") ? (
                    <Icon name="check" size={12} />
                  ) : matched.length > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-text-blue" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-text-muted-2" />
                  )}
                </span>
                <span className="text-sm text-foreground">{item}</span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {matched.length > 0 ? (
                  <div className="flex flex-col items-end gap-1">
                    {matched.map((doc) => (
                      <div key={doc.id} className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
                            className="inline-flex items-center gap-1 hover:opacity-80 transition cursor-pointer"
                          >
                            <Badge
                              variant={
                                doc.status === "approved"
                                  ? "success"
                                  : doc.status === "needs_revision"
                                  ? "warning"
                                  : doc.status === "under_review"
                                  ? "info"
                                  : "neutral"
                              }
                            >
                              {doc.status === "approved" && <Icon name="check" size={10} className="inline mr-0.5" />}
                              {doc.status === "approved" ? "Verified" : doc.status === "needs_revision" ? "Needs Changes" : doc.status === "under_review" ? "Under Review" : "Uploaded"}
                              <span className="opacity-60 ml-1">v{doc.version}</span>
                            </Badge>
                            <Icon name="eye" size={14} className="text-text-muted-2" />
                          </button>
                          {/* Replace icon */}
                          <label className="p-1 rounded hover:bg-surface-elevated transition cursor-pointer" title="Replace document">
                            <Icon name="upload" size={14} className="text-amber-500" />
                            <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplace(f, doc); e.target.value = ""; }} />
                          </label>
                          {/* Delete icon */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(doc); }}
                            disabled={deletingDocId === doc.id}
                            className="p-1 rounded hover:bg-red-50 transition disabled:opacity-50"
                            title="Delete document"
                          >
                            <Icon name="trash" size={14} className="text-red-400" />
                          </button>
                        </div>
                        {/* Mentor / admin review actions */}
                        {isMentor && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {doc.status !== "approved" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDocStatus(doc, "approved"); }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-green hover:opacity-80 transition"
                              >
                                <Icon name="check" size={12} /> Setujui
                              </button>
                            )}
                            {doc.status !== "needs_revision" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDocStatus(doc, "needs_revision"); }}
                                className="text-[11px] font-medium text-amber-600 hover:opacity-80 transition"
                              >
                                Minta revisi
                              </button>
                            )}
                          </div>
                        )}
                        {doc.status === "needs_revision" && doc.feedback && (
                          <span className="text-[10px] text-amber-600 max-w-[200px] truncate" title={doc.feedback}>
                            Mentor: &ldquo;{doc.feedback}&rdquo;
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : isUploading ? (
                  <span className="text-xs text-primary">Uploading...</span>
                ) : (
                  <label className="inline-flex items-center gap-1 text-xs text-primary font-medium cursor-pointer hover:opacity-80 transition">
                    <Icon name="upload" size={14} />
                    <span>Upload</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, item);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Document"
        description={`Delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={!!deletingDocId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// MENTEE RATING
// ─────────────────────────────────────────────

function MenteeFeedback({
  currentRating,
  currentFeedback,
  pairingId,
  sessionNum,
  onRefresh,
}: {
  currentRating: number;
  currentFeedback: string;
  pairingId: string;
  sessionNum: number;
  onRefresh: () => void;
}) {
  const hasSubmitted = currentRating > 0 && currentFeedback.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(currentRating);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState(currentFeedback);
  const [saving, setSaving] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function submitRating(value: number) {
    setRating(value);
    setSaving(true);
    await fetch(`/api/pairings/${pairingId}/sessions/${sessionNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorRating: value }),
    });
    setSaving(false);
    onRefresh();
  }

  async function submitFeedback() {
    setSaving(true);
    await fetch(`/api/pairings/${pairingId}/sessions/${sessionNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menteeFeedback: feedback }),
    });
    setSaving(false);
    setIsEditing(false);
    setJustSubmitted(true);
    onRefresh();
  }

  // Show submitted confirmation view
  if ((hasSubmitted || justSubmitted) && !isEditing) {
    return (
      <div className="bg-surface-green border border-surface-green-border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="check" size={18} className="text-text-green" />
          <h4 className="text-sm font-semibold text-text-green">
            Thanks! Your feedback has been submitted to your mentor.
          </h4>
        </div>

        <div className="bg-surface rounded-lg border border-surface-green-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Your rating:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Icon
                  key={s}
                  name="star"
                  size={14}
                  className={s <= (rating || currentRating) ? "text-brand-yellow" : "text-text-muted-2"}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-text-muted-3">{rating || currentRating}/5</span>
          </div>
          {(feedback || currentFeedback) && (
            <div>
              <span className="text-xs text-text-muted">Your feedback:</span>
              <p className="text-sm text-foreground mt-0.5">&ldquo;{feedback || currentFeedback}&rdquo;</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-primary hover:underline font-medium"
        >
          Edit feedback
        </button>
      </div>
    );
  }

  // Editable form
  return (
    <div className="bg-surface-purple border border-surface-purple-border rounded-lg p-5 space-y-4">
      <h4 className="text-xs font-semibold text-text-purple uppercase">
        Your Feedback
      </h4>

      {/* Star rating */}
      <div>
        <p className="text-xs text-text-muted mb-1.5">Rate your mentor</p>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => submitRating(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                disabled={saving}
                className="text-2xl transition hover:scale-110 disabled:opacity-50"
              >
                <Icon
                  name="star"
                  size={24}
                  className={star <= (hoveredStar || rating) ? "text-brand-yellow" : "text-text-muted-2"}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <span className="text-sm text-purple-600 font-medium">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <p className="text-xs text-text-muted mb-1.5">Share your impression</p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-surface focus:ring-2 focus:ring-purple-300 focus:border-transparent outline-none"
          placeholder="How was the session? Any thoughts for your mentor?"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={submitFeedback}
            disabled={saving || !feedback.trim()}
            className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit Feedback"}
          </button>
          {isEditing && (
            <button
              onClick={() => { setIsEditing(false); setFeedback(currentFeedback); setRating(currentRating); }}
              className="text-xs text-text-muted hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DOCUMENTS TAB
// ─────────────────────────────────────────────

function DocumentsTab({
  pairingId,
  menteeName,
  isAdmin,
  isMentor,
  onRefresh,
  onPreview,
}: {
  pairingId: string;
  menteeName: string;
  isAdmin?: boolean;
  isMentor: boolean;
  onRefresh: () => void;
  onPreview: (doc: Doc) => void;
}) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    category: "cv",
    file: null as File | null,
  });
  const [reviewingDoc, setReviewingDoc] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [reviewStatus, setReviewStatus] = useState("under_review");
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [replacingFile, setReplacingFile] = useState<File | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Doc | null>(null);
  const [zipping, setZipping] = useState(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveResult, setDriveResult] = useState<{ ok: boolean; text: string; url?: string } | null>(null);

  /** Push all documents to the SatuTuju Google Drive, folder per student
   *  (admin archive for master-agency registration). Idempotent server-side. */
  async function syncToDrive() {
    if (driveSyncing) return;
    setDriveSyncing(true);
    setDriveResult(null);
    try {
      const res = await fetch(`/api/pairings/${pairingId}/drive-sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const bits = [`${data.uploaded} baru`, `${data.skipped} sudah ada`];
        if (data.failed?.length) bits.push(`${data.failed.length} gagal`);
        setDriveResult({ ok: true, text: `Tersync ke folder "${data.folderName}" — ${bits.join(", ")}.`, url: data.folderUrl });
      } else {
        setDriveResult({ ok: false, text: data.error || "Gagal sync ke Drive." });
      }
    } catch {
      setDriveResult({ ok: false, text: "Gagal sync — periksa koneksi lalu coba lagi." });
    } finally {
      setDriveSyncing(false);
    }
  }

  /** Download every uploaded document as one ZIP, files named
   *  "{Mentee}/{Doc} - vN.ext" — for the admin workflow of archiving a
   *  student's berkas into Google Drive. Zipped client-side (jszip, lazy
   *  import) so files stream straight from the public bucket, no server
   *  size limits. */
  async function downloadAllZip() {
    if (docs.length === 0 || zipping) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim();
      const folder = zip.folder(safe(menteeName))!;
      const used = new Set<string>();
      let failed = 0;
      for (const d of docs) {
        try {
          const res = await fetch(d.filePath);
          if (!res.ok) { failed++; continue; }
          const blob = await res.blob();
          const ext = (d.fileName || d.filePath).split(".").pop() || "bin";
          let name = `${safe(d.name)} - v${d.version}.${ext}`;
          for (let i = 2; used.has(name); i++) name = `${safe(d.name)} - v${d.version} (${i}).${ext}`;
          used.add(name);
          folder.file(name, blob);
        } catch {
          failed++;
        }
      }
      if (used.size === 0) { toast.error("Tidak ada file yang bisa diunduh."); return; }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe(menteeName)} - Dokumen SatuTuju.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (failed > 0) toast.error(`${failed} file gagal diunduh — cek koneksi lalu coba lagi.`);
    } finally {
      setZipping(false);
    }
  }

  const refreshDocs = useCallback(async () => {
    const res = await fetch(`/api/pairings/${pairingId}/documents`);
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents || []);
    }
    setDocsLoading(false);
  }, [pairingId]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", uploadForm.file);
    formData.append("name", uploadForm.name);
    formData.append("category", uploadForm.category);

    await fetch(`/api/pairings/${pairingId}/documents`, {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    setShowUpload(false);
    setUploadForm({ name: "", category: "cv", file: null });
    await refreshDocs();
    onRefresh();
  }

  async function submitReview(docId: string) {
    await fetch(`/api/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: reviewStatus, feedback }),
    });
    setReviewingDoc(null);
    setFeedback("");
    await refreshDocs();
    onRefresh();
  }

  async function handleReplace(doc: Doc) {
    if (!replacingFile) return;
    setDeletingDocId(doc.id);
    // Upload new version with same name/category
    const formData = new FormData();
    formData.append("file", replacingFile);
    formData.append("name", doc.name);
    formData.append("category", doc.category);
    await fetch(`/api/pairings/${pairingId}/documents`, {
      method: "POST",
      body: formData,
    });
    // Delete old version
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setReplacingDocId(null);
    setReplacingFile(null);
    setDeletingDocId(null);
    await refreshDocs();
    onRefresh();
  }

  async function handleDelete(doc: Doc) {
    setDeletingDocId(doc.id);
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setDeletingDocId(null);
    setDeleteConfirm(null);
    await refreshDocs();
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">All Documents</h3>
        <div className="flex items-center gap-2">
        {isAdmin && docs.length > 0 && (
          <button
            onClick={syncToDrive}
            disabled={driveSyncing}
            className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-elevated inline-flex items-center gap-1.5 disabled:opacity-60"
            title="Kirim semua dokumen ke Google Drive SatuTuju (folder per nama siswa)"
          >
            <Icon name="upload" size={16} />
            {driveSyncing ? "Sync ke Drive…" : "Sync ke Drive"}
          </button>
        )}
        {docs.length > 0 && (
          <button
            onClick={downloadAllZip}
            disabled={zipping}
            className="border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-elevated inline-flex items-center gap-1.5 disabled:opacity-60"
            title="Unduh semua dokumen sebagai ZIP (folder per nama siswa)"
          >
            <Icon name="download" size={16} />
            {zipping ? "Menyiapkan ZIP…" : `Download semua (${docs.length})`}
          </button>
        )}
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
        >
          <Icon name="plus" size={16} />
          Upload Document
        </button>
        </div>
      </div>

      {driveResult && (
        <p className={`text-sm ${driveResult.ok ? "text-green-700" : "text-red-600"}`}>
          {driveResult.text}{" "}
          {driveResult.url && (
            <a href={driveResult.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
              Buka folder →
            </a>
          )}
        </p>
      )}

      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="card space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Document Name
              </label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, name: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. Motivation Letter v1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Category
              </label>
              <Select
                value={uploadForm.category}
                onChange={(v) => setUploadForm({ ...uploadForm, category: v })}
                options={DOCUMENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              File
            </label>
            <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center hover:border-primary/50 transition">
              <Icon name="upload" size={28} className="mx-auto text-primary/40 mb-2" />
              <input
                type="file"
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    file: e.target.files?.[0] || null,
                  })
                }
                required
                className="w-full text-sm"
              />
              {uploadForm.file && (
                <p className="text-xs text-primary mt-2 font-medium">
                  Selected: {uploadForm.file.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 rounded-lg text-sm text-text-muted-3 hover:bg-surface-elevated"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {docsLoading ? (
        <div className="card py-10 animate-pulse bg-surface-elevated" />
      ) : docs.length === 0 ? (
        <div className="card text-center py-12 text-text-muted-2 text-sm">
          <Icon name="document" size={36} className="mx-auto mb-3 text-text-muted-2" />
          No documents uploaded yet
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="card card-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon name="document" size={16} className="text-text-muted-2" />
                    <h4 className="font-medium text-sm">{doc.name}</h4>
                    <span className="text-xs text-text-muted-2">v{doc.version}</span>
                  </div>
                  <p className="text-xs text-text-muted-2 mt-0.5 ml-6">
                    {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label} &middot;{" "}
                    {(doc.fileSize / 1024).toFixed(0)} KB &middot;{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      doc.status === "approved"
                        ? "success"
                        : doc.status === "needs_revision"
                        ? "warning"
                        : doc.status === "under_review"
                        ? "info"
                        : "neutral"
                    }
                  >
                    {doc.status.replace("_", " ")}
                  </Badge>
                  <button
                    onClick={() => onPreview(doc)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Icon name="eye" size={14} />
                    Preview
                  </button>
                  {isMentor && (
                    <button
                      onClick={() => {
                        setReviewingDoc(
                          reviewingDoc === doc.id ? null : doc.id
                        );
                        setFeedback(doc.feedback || "");
                        setReviewStatus(doc.status);
                      }}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Icon name="edit" size={14} />
                      Review
                    </button>
                  )}
                  {/* Replace icon */}
                  <label className="p-1.5 rounded-lg hover:bg-amber-50 transition cursor-pointer" title="Replace document">
                    <Icon name="upload" size={16} className="text-amber-500" />
                    <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReplacingFile(f); setReplacingDocId(doc.id); } e.target.value = ""; }} />
                  </label>
                  {/* Delete icon */}
                  <button
                    onClick={() => setDeleteConfirm(doc)}
                    disabled={deletingDocId === doc.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                    title="Delete document"
                  >
                    {deletingDocId === doc.id
                      ? <span className="text-xs text-red-400">...</span>
                      : <Icon name="trash" size={16} className="text-red-400" />
                    }
                  </button>
                </div>
              </div>

              {doc.feedback && reviewingDoc !== doc.id && (
                <div className="mt-3 p-3 bg-[var(--accent)] rounded-lg">
                  <p className="text-xs font-medium text-text-muted mb-1">
                    Mentor Feedback
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {doc.feedback}
                  </p>
                </div>
              )}

              {replacingDocId === doc.id && replacingFile && (
                <div className="mt-3 p-4 bg-surface-amber border border-surface-amber-border rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-text-amber uppercase">Replace Document</p>
                  <p className="text-xs text-text-muted-3">New file: <span className="font-medium">{replacingFile.name}</span></p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReplace(doc)}
                      disabled={deletingDocId === doc.id}
                      className="bg-amber-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {deletingDocId === doc.id ? "Replacing..." : "Upload New Version"}
                    </button>
                    <button
                      onClick={() => { setReplacingDocId(null); setReplacingFile(null); }}
                      className="text-xs text-text-muted hover:text-foreground px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {reviewingDoc === doc.id && (
                <div className="mt-3 space-y-3 p-4 bg-surface-elevated rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Status
                    </label>
                    <Select
                      value={reviewStatus}
                      onChange={(v) => setReviewStatus(v)}
                      options={[
                        { value: "under_review", label: "Under Review" },
                        { value: "needs_revision", label: "Needs Revision" },
                        { value: "approved", label: "Approved" },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">
                      Feedback
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      placeholder="Provide feedback on this document..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitReview(doc.id)}
                      className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                    >
                      Submit Review
                    </button>
                    <button
                      onClick={() => setReviewingDoc(null)}
                      className="px-4 py-2 rounded-lg text-sm text-text-muted-3 hover:bg-surface-elevated"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        title="Delete Document"
        description={`Delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={!!deletingDocId}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// TASKS TAB
// ─────────────────────────────────────────────

function TasksTab({
  tasks,
  pairingId,
  isMentor,
  onRefresh,
}: {
  tasks: Task[];
  pairingId: string;
  isMentor: boolean;
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    sessionNum: "",
    dueDate: "",
  });

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/pairings/${pairingId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newTask,
        sessionNum: newTask.sessionNum
          ? parseInt(newTask.sessionNum)
          : undefined,
      }),
    });
    setShowCreate(false);
    setNewTask({ title: "", description: "", sessionNum: "", dueDate: "" });
    onRefresh();
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  const pending = tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Tasks & Homework</h3>
        {isMentor && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Icon name="plus" size={16} />
            Assign Task
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={createTask}
          className="card space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask({ ...newTask, title: e.target.value })
                }
                required
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="e.g. Submit ML draft v1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">
                Description (optional)
              </label>
              <textarea
                value={newTask.description}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Details about this task..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Related Session (optional)
              </label>
              <Select
                value={newTask.sessionNum}
                onChange={(v) => setNewTask({ ...newTask, sessionNum: v })}
                options={[
                  { value: "", label: "None" },
                  ...CURRICULUM.map((s) => ({
                    value: String(s.sessionNum),
                    label: `Session ${s.sessionNum}: ${s.topic}`,
                  })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Due Date (optional)
              </label>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) =>
                  setNewTask({ ...newTask, dueDate: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              Create Task
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm text-text-muted-3 hover:bg-surface-elevated"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted-2 uppercase mb-2">
            Pending ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((task) => (
              <div
                key={task.id}
                className="card card-hover flex items-center justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded border-2 border-border flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-text-muted mt-0.5">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {task.sessionNum && (
                        <span className="text-xs text-text-muted-2">
                          Session {task.sessionNum}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-xs text-text-muted-2 inline-flex items-center gap-1">
                          <Icon name="calendar" size={12} />
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <Badge variant="warning" size="sm">
                        {task.status === "in_progress" ? "In Progress" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => updateTaskStatus(task.id, "completed")}
                  className="text-xs bg-surface-green text-text-green px-3 py-1.5 rounded-full font-medium hover:opacity-80 transition inline-flex items-center gap-1"
                >
                  <Icon name="check" size={12} />
                  Mark Complete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {completed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted-2 uppercase mb-2">
            Completed ({completed.length})
          </p>
          <div className="space-y-2">
            {completed.map((task) => (
              <div
                key={task.id}
                className="card opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-surface-green flex items-center justify-center flex-shrink-0">
                    <Icon name="check" size={12} className="text-text-green" />
                  </div>
                  <p className="text-sm line-through">{task.title}</p>
                  <Badge variant="success" size="sm">Done</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="card text-center py-12 text-text-muted-2 text-sm">
          <Icon name="clipboard-check" size={36} className="mx-auto mb-3 text-text-muted-2" />
          No tasks yet.{" "}
          {isMentor
            ? "Assign a task to your mentee."
            : "Your mentor will assign tasks soon."}
        </div>
      )}
    </div>
  );
}
