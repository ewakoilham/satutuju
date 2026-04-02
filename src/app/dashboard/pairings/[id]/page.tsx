"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import { CURRICULUM, DOCUMENT_CATEGORIES } from "@/lib/curriculum";

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
  mentor: { id: string; name: string; email: string };
  mentee: { id: string; name: string; email: string };
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

  useEffect(() => {
    fetchPairing();
  }, [fetchPairing]);

  if (loading || !pairing || !user) {
    return <div className="text-gray-400">Loading...</div>;
  }

  const isMentor = user.role === "mentor" || user.role === "admin";
  const isAdmin = user.role === "admin";
  const completed = pairing.sessions.filter(
    (s) => s.status === "completed"
  ).length;

  // Admin action states
  const [showReplaceMentor, setShowReplaceMentor] = useState(false);
  const [allMentors, setAllMentors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [newMentorId, setNewMentorId] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/users?role=mentor").then(r => r.json()).then(d => setAllMentors(d.users || []));
    }
  }, [isAdmin]);

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
        alert(data.error || "Failed to replace mentor");
      } else {
        setShowReplaceMentor(false);
        setNewMentorId("");
        fetchPairing();
      }
    } catch {
      alert("Network error");
    }
    setAdminActionLoading(false);
  }

  async function handleRemovePairing() {
    if (!pairing) return;
    if (!window.confirm(`Cancel the pairing between ${pairing.mentor.name} and ${pairing.mentee.name}? This cannot be undone.`)) return;
    setAdminActionLoading(true);
    try {
      const res = await fetch(`/api/pairings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to cancel pairing");
      } else {
        router.push("/dashboard");
      }
    } catch {
      alert("Network error");
    }
    setAdminActionLoading(false);
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
            className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block"
          >
            &larr; Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold">
            {pairing.mentee.name}
            <span className="text-gray-400 font-normal text-lg ml-2">
              &times; {pairing.mentor.name}
            </span>
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {pairing.targetProgram && (
              <span className="text-[var(--primary)]">
                {pairing.targetProgram}
              </span>
            )}
            {pairing.ieltsScore && <span>IELTS: {pairing.ieltsScore}</span>}
            {isMentor && (
              <button
                onClick={() => router.push(`/dashboard/profile/${pairing.mentee.id}`)}
                className="text-[var(--primary)] hover:underline font-medium"
              >
                View Mentee Profile
              </button>
            )}
          </div>
          {/* Admin actions */}
          {isAdmin && pairing.status !== "cancelled" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {showReplaceMentor ? (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <select
                    value={newMentorId}
                    onChange={(e) => setNewMentorId(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  >
                    <option value="">Select new mentor...</option>
                    {allMentors.filter((m) => m.id !== pairing.mentor.id).map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                  <button
                    onClick={handleReplaceMentor}
                    disabled={!newMentorId || adminActionLoading}
                    className="text-sm bg-[var(--primary)] text-white px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {adminActionLoading ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => { setShowReplaceMentor(false); setNewMentorId(""); }}
                    className="text-sm text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowReplaceMentor(true)}
                  className="text-sm text-amber-600 hover:underline font-medium"
                >
                  Replace Mentor
                </button>
              )}
              <button
                onClick={handleRemovePairing}
                disabled={adminActionLoading}
                className="text-sm text-red-500 hover:underline font-medium disabled:opacity-50"
              >
                Remove Pairing
              </button>
            </div>
          )}
          {pairing.status === "cancelled" && (
            <span className="inline-block mt-2 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
              Cancelled
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Progress</div>
          <div className="text-2xl font-bold text-[var(--primary)]">
            {completed}/10
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] rounded-full transition-all"
          style={{ width: `${(completed / 10) * 100}%` }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === t.key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs bg-gray-100 rounded-full px-2 py-0.5">
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
          documents={pairing.documents}
          pairingId={pairing.id}
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-sm">{previewDoc.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {previewDoc.fileName} &middot; {(previewDoc.fileSize / 1024).toFixed(0)} KB &middot; v{previewDoc.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${getDocUrl(previewDoc)}?download=1`}
                  className="inline-flex items-center gap-1.5 bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
                >
                  Download
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50 min-h-[400px]">
              {isOfficeFile(previewDoc.fileName) ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(window.location.origin + getDocUrl(previewDoc))}&embedded=true`}
                  className="w-full h-full min-h-[500px] rounded-lg border border-gray-200 bg-white"
                />
              ) : getFileExt(previewDoc.fileName) === "pdf" ? (
                <iframe
                  src={getDocUrl(previewDoc)}
                  className="w-full h-full min-h-[500px] rounded-lg border border-gray-200"
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
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400">
                  <div className="text-5xl mb-4">📄</div>
                  <p className="text-sm font-medium mb-1">Preview not available for this file type</p>
                  <p className="text-xs">Click Download to view the file</p>
                </div>
              )}
            </div>
            {/* Feedback if any */}
            {previewDoc.feedback && (
              <div className="px-6 py-3 border-t border-gray-200 bg-amber-50">
                <p className="text-xs font-medium text-gray-500 mb-1">Mentor Feedback</p>
                <p className="text-sm text-gray-700">{previewDoc.feedback}</p>
              </div>
            )}
          </div>
        </div>
      )}
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
  const [expandedSession, setExpandedSession] = useState<number | null>(null);

  const PHASE_STYLES: Record<string, string> = {
    discovery: "border-l-blue-500",
    planning: "border-l-amber-500",
    writing: "border-l-purple-500",
    execution: "border-l-orange-500",
    closing: "border-l-green-500",
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const template = CURRICULUM[session.sessionNum - 1];
        const isExpanded = expandedSession === session.sessionNum;

        return (
          <div
            key={session.id}
            className={`bg-white rounded-xl border border-gray-200 border-l-4 ${
              PHASE_STYLES[session.phase] || ""
            } overflow-hidden`}
          >
            <div
              className="px-6 py-4 cursor-pointer flex items-center justify-between"
              onClick={() =>
                setExpandedSession(isExpanded ? null : session.sessionNum)
              }
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    session.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {session.status === "completed" ? "✓" : session.sessionNum}
                </div>
                <div>
                  <p className="font-medium text-sm">{session.topic}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {session.phase} &middot; {template?.duration || 75} min
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {session.menteeEnergy && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      session.menteeEnergy <= 2
                        ? "bg-red-100 text-red-600"
                        : session.menteeEnergy <= 3
                        ? "bg-amber-100 text-amber-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    Energy: {session.menteeEnergy}/5
                  </span>
                )}
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    session.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : session.status === "scheduled"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {session.status}
                </span>
                <span className="text-gray-400 text-sm">
                  {isExpanded ? "▲" : "▼"}
                </span>
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

// Maps curriculum doc checklist keywords to document categories
const DOC_CHECKLIST_MATCH: Record<string, string[]> = {
  "cv": ["cv"],
  "resume": ["cv"],
  "university": ["other"],
  "transcript": ["transcript"],
  "language test": ["ielts"],
  "financial": ["other"],
  "application tracker": ["other"],
  "deadline": ["other"],
  "narrative": ["other"],
  "ml": ["motivation_letter"],
  "ps": ["motivation_letter"],
  "motivation letter": ["motivation_letter"],
  "lpdp": ["essay_lpdp"],
  "essay": ["essay_lpdp"],
  "academic cv": ["cv"],
  "certificate": ["certificate"],
  "recommendation": ["recommendation"],
  "interview": ["other"],
  "mock": ["other"],
  "submission": ["other"],
  "post-submission": ["other"],
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
  // Try category matching
  for (const [keyword, categories] of Object.entries(DOC_CHECKLIST_MATCH)) {
    if (lower.includes(keyword)) {
      const matched = documents.filter((d) => categories.includes(d.category));
      if (matched.length > 0) return matched;
    }
  }
  // Fallback: fuzzy name match
  const words = lower.split(/[\s\/\(\)]+/).filter((w) => w.length > 2);
  return documents.filter((d) => {
    const docName = d.name.toLowerCase();
    return words.some((w) => docName.includes(w));
  });
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
    <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
      {/* SESSION RESULTS — always shown first */}
      {hasResults && !editing ? (
        <div className="space-y-4">
          {/* Ratings row */}
          <div className={`grid grid-cols-2 ${isMentor ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-3`}>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p className={`text-sm font-semibold capitalize ${
                session.status === "completed" ? "text-green-600" : "text-gray-600"
              }`}>{session.status}</p>
            </div>
            {isMentor && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Mentor Rating</p>
                <p className="text-sm font-semibold">
                  {session.mentorRating ? `${session.mentorRating}/5` : "—"}
                </p>
              </div>
            )}
            {isMentor && (
              <div className={`rounded-lg p-3 text-center ${
                session.menteeEnergy && session.menteeEnergy <= 2
                  ? "bg-red-50"
                  : session.menteeEnergy && session.menteeEnergy <= 3
                  ? "bg-amber-50"
                  : "bg-gray-50"
              }`}>
                <p className="text-xs text-gray-400 mb-1">Mentee Energy</p>
                <p className={`text-sm font-semibold ${
                  session.menteeEnergy && session.menteeEnergy <= 2
                    ? "text-red-600"
                    : session.menteeEnergy && session.menteeEnergy <= 3
                    ? "text-amber-600"
                    : ""
                }`}>
                  {session.menteeEnergy ? `${session.menteeEnergy}/5` : "—"}
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Completed</p>
              <p className="text-sm font-semibold">
                {session.completedAt
                  ? new Date(session.completedAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          {/* Key Output */}
          {session.keyOutput && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-green-700 uppercase mb-1">
                Key Output
              </h4>
              <p className="text-sm text-gray-700">{session.keyOutput}</p>
            </div>
          )}

          {/* Session Summary */}
          {session.summaryNotes && (
            <div className="bg-[var(--accent)] border border-amber-100 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-amber-700 uppercase mb-1">
                Session Summary
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {session.summaryNotes}
              </p>
            </div>
          )}

          {/* Obstacles */}
          {session.obstacles && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-red-700 uppercase mb-1">
                Obstacles / Concerns
              </h4>
              <p className="text-sm text-gray-700">{session.obstacles}</p>
            </div>
          )}

          {/* Mentee feedback — visible to mentor/admin */}
          {isMentor && session.menteeFeedback && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-purple-700 uppercase mb-1">
                Mentee Feedback
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.menteeFeedback}</p>
              {session.mentorRating && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs text-gray-400">Rating:</span>
                  <span className="text-sm">{Array.from({ length: session.mentorRating }, () => "★").join("")}</span>
                  <span className="text-xs text-purple-600 font-medium">{session.mentorRating}/5</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : !editing ? (
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-400">
            No session results yet. {isMentor ? "Click \"Edit session details\" to log results after the session." : "Your mentor will log results after the session."}
          </p>
        </div>
      ) : null}

      {/* Session Deliverables — links doc checklist to actual uploads */}
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
          className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg hover:opacity-90 transition"
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

      {/* Curriculum reference — collapsible, mentor/admin only */}
      {isMentor && <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowCurriculum(!showCurriculum)}
          className="text-xs text-gray-400 hover:text-gray-600 font-medium uppercase tracking-wide"
        >
          {showCurriculum ? "▲ Hide" : "▼ Show"} Curriculum Guide
        </button>

        {showCurriculum && (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Objective
                </h4>
                <p className="text-sm text-gray-700">{template.objective}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Deliverables
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {template.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">-</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Mentee Preparation
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {template.menteePrep.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">-</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Document Checklist
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {template.docChecklist.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">-</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>}

      {editing && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="upcoming">Upcoming</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Key Output
            </label>
            <input
              type="text"
              value={form.keyOutput}
              onChange={(e) =>
                setForm({ ...form, keyOutput: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="What was achieved in this session?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">
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
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
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

  async function handleUpload(file: File, checklistItem: string) {
    setUploadingItem(checklistItem);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", checklistItem);
    formData.append("category", guessCategory(checklistItem));

    await fetch(`/api/pairings/${pairingId}/documents`, {
      method: "POST",
      body: formData,
    });
    setUploadingItem(null);
    onRefresh();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
        Session Deliverables
      </h4>
      <div className="space-y-2">
        {checklist.map((item, i) => {
          const matched = findMatchingDocs(item, documents);
          const isUploading = uploadingItem === item;
          return (
            <div key={i} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  matched.some((d) => d.status === "approved")
                    ? "bg-green-100 text-green-600"
                    : matched.length > 0
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {matched.some((d) => d.status === "approved") ? "✓" : matched.length > 0 ? "●" : "○"}
                </span>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {matched.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {matched.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          doc.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : doc.status === "needs_revision"
                            ? "bg-amber-100 text-amber-700"
                            : doc.status === "under_review"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        } hover:opacity-80 transition cursor-pointer`}
                      >
                        {doc.name} <span className="opacity-60">v{doc.version}</span>
                        <span className="ml-0.5">👁</span>
                      </button>
                    ))}
                  </div>
                ) : isUploading ? (
                  <span className="text-xs text-[var(--primary)]">Uploading...</span>
                ) : (
                  <label className="inline-flex items-center gap-1 text-xs text-[var(--primary)] font-medium cursor-pointer hover:opacity-80 transition">
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
  const [rating, setRating] = useState(currentRating);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState(currentFeedback);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submitRating(value: number) {
    setRating(value);
    setSaving(true);
    await fetch(`/api/pairings/${pairingId}/sessions/${sessionNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorRating: value }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh();
  }

  return (
    <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-4">
      <h4 className="text-xs font-semibold text-purple-700 uppercase">
        Your Feedback
      </h4>

      {/* Star rating */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Rate your mentor</p>
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
                {star <= (hoveredStar || rating) ? "★" : "☆"}
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
        <p className="text-xs text-gray-500 mb-1.5">Share your impression</p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-300 focus:border-transparent outline-none"
          placeholder="How was the session? Any thoughts for your mentor?"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={submitFeedback}
            disabled={saving || feedback === currentFeedback}
            className="bg-[var(--primary)] text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Feedback"}
          </button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// DOCUMENTS TAB
// ─────────────────────────────────────────────

function DocumentsTab({
  documents,
  pairingId,
  isMentor,
  onRefresh,
  onPreview,
}: {
  documents: Doc[];
  pairingId: string;
  isMentor: boolean;
  onRefresh: () => void;
  onPreview: (doc: Doc) => void;
}) {
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
    onRefresh();
  }

  const STATUS_STYLES: Record<string, string> = {
    uploaded: "bg-gray-100 text-gray-600",
    under_review: "bg-blue-100 text-blue-700",
    needs_revision: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">All Documents</h3>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          + Upload Document
        </button>
      </div>

      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Category
              </label>
              <select
                value={uploadForm.category}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, category: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              File
            </label>
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
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400 text-sm">
          No documents uploaded yet
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{doc.name}</h4>
                    <span className="text-xs text-gray-400">v{doc.version}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)?.label} &middot;{" "}
                    {(doc.fileSize / 1024).toFixed(0)} KB &middot;{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      STATUS_STYLES[doc.status] || ""
                    }`}
                  >
                    {doc.status.replace("_", " ")}
                  </span>
                  <button
                    onClick={() => onPreview(doc)}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
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
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>

              {doc.feedback && reviewingDoc !== doc.id && (
                <div className="mt-3 p-3 bg-[var(--accent)] rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Mentor Feedback
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {doc.feedback}
                  </p>
                </div>
              )}

              {reviewingDoc === doc.id && (
                <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Status
                    </label>
                    <select
                      value={reviewStatus}
                      onChange={(e) => setReviewStatus(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="under_review">Under Review</option>
                      <option value="needs_revision">Needs Revision</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
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
                      className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                    >
                      Submit Review
                    </button>
                    <button
                      onClick={() => setReviewingDoc(null)}
                      className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
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
            className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            + Assign Task
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={createTask}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Related Session (optional)
              </label>
              <select
                value={newTask.sessionNum}
                onChange={(e) =>
                  setNewTask({ ...newTask, sessionNum: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">None</option>
                {CURRICULUM.map((s) => (
                  <option key={s.sessionNum} value={s.sessionNum}>
                    Session {s.sessionNum}: {s.topic}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
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
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              Create Task
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Pending ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {task.sessionNum && (
                      <span className="text-xs text-gray-400">
                        Session {task.sessionNum}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-xs text-gray-400">
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => updateTaskStatus(task.id, "completed")}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium hover:bg-green-200 transition"
                >
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
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
            Completed ({completed.length})
          </p>
          <div className="space-y-2">
            {completed.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 p-4 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <p className="text-sm line-through">{task.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400 text-sm">
          No tasks yet.{" "}
          {isMentor
            ? "Assign a task to your mentee."
            : "Your mentor will assign tasks soon."}
        </div>
      )}
    </div>
  );
}
