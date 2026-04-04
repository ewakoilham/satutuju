"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PHASES, CURRICULUM } from "@/lib/curriculum";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

interface Session {
  sessionNum: number;
  phase: string;
  topic: string;
  status: string;
  scheduledAt?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  sessionNum?: number;
}

interface Document {
  id: string;
  name: string;
  category: string;
  status: string;
}

interface Pairing {
  id: string;
  status: string;
  targetProgram?: string;
  mentor: { id: string; name: string; email: string };
  sessions: Session[];
  tasks: Task[];
  documents: Document[];
}

interface MenteeProfile {
  intendedStudyProgram?: string;
  preferredDestinations?: string;
}

// Map checklist keywords to document categories (same as pairing detail page)
const DOC_CAT_MAP: Record<string, string[]> = {
  cv: ["cv"], resume: ["cv"], transcript: ["transcript"],
  "language test": ["ielts"], motivation: ["motivation_letter"],
  ml: ["motivation_letter"], ps: ["motivation_letter"],
  lpdp: ["essay_lpdp"], essay: ["essay_lpdp"],
  certificate: ["certificate"], recommendation: ["recommendation"],
};

function checklistItemUploaded(item: string, docs: Document[]): boolean {
  const lower = item.toLowerCase();
  for (const [keyword, cats] of Object.entries(DOC_CAT_MAP)) {
    if (lower.includes(keyword)) {
      return docs.some((d) => cats.includes(d.category));
    }
  }
  return docs.some((d) => d.name.toLowerCase().includes(lower.split(/[\s\/\(\)]+/).filter(w => w.length > 2)[0] || ""));
}

const PHASE_ICONS: Record<string, string> = {
  discovery: "search",
  planning: "map",
  writing: "edit",
  execution: "document",
  closing: "check",
};

export default function MenteeDashboard() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [profile, setProfile] = useState<MenteeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/pairings")
        .then((r) => r.json())
        .then(async (d) => {
          const detailed = await Promise.all(
            (d.pairings || []).map(async (p: { id: string }) => {
              const res = await fetch(`/api/pairings/${p.id}`);
              const data = await res.json();
              return data.pairing;
            })
          );
          setPairings(detailed.filter(Boolean));
        }),
      fetch("/api/profile")
        .then((r) => r.json())
        .then((d) => setProfile(d.profile || null)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  if (pairings.length === 0) {
    return (
      <EmptyState
        icon="map"
        title="Your journey hasn't started yet"
        description="You'll be paired with a mentor soon. Hang tight!"
      />
    );
  }

  const pairing = pairings[0];
  const completed = pairing.sessions.filter((s) => s.status === "completed").length;
  const nextSession = pairing.sessions.find((s) => s.status === "scheduled" || s.status === "upcoming");
  const pendingTasks = pairing.tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const docsNeedingRevision = pairing.documents.filter((d) => d.status === "needs_revision");

  // Upcoming deadlines — tasks with due dates, sorted soonest first
  const upcomingDeadlines = pendingTasks
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  // Document checklist progress
  const allChecklistItems = CURRICULUM.flatMap((s) => s.docChecklist);
  const uploadedCount = allChecklistItems.filter((item) =>
    checklistItemUploaded(item, pairing.documents)
  ).length;
  const totalChecklist = allChecklistItems.length;

  // Approved docs count
  const approvedDocs = pairing.documents.filter((d) => d.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">My Journey</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your mentor:{" "}
          <span className="font-medium text-gray-700">{pairing.mentor.name}</span>
          {(() => {
            const target = profile?.intendedStudyProgram || pairing.targetProgram;
            const destinations = profile?.preferredDestinations;
            if (!target) return null;
            return (
              <>
                {" "}&middot; Target:{" "}
                <span className="text-[var(--primary)]">{target}</span>
                {destinations && (
                  <span className="text-gray-400"> &middot; {destinations}</span>
                )}
              </>
            );
          })()}
        </p>
      </div>

      {/* Top cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Next Session */}
        <Link
          href={`/dashboard/pairings/${pairing.id}`}
          className="card card-hover p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-blue-soft flex items-center justify-center">
              <Icon name="calendar" size={18} className="text-primary" />
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase">Next Session</p>
          </div>
          {nextSession ? (
            <>
              <p className="text-sm font-semibold">
                Session {nextSession.sessionNum}: {nextSession.topic}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {nextSession.scheduledAt
                  ? new Date(nextSession.scheduledAt).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Not scheduled yet"}
              </p>
              <div className="mt-2">
                <Badge variant={nextSession.status === "scheduled" ? "info" : "neutral"}>
                  {nextSession.status}
                </Badge>
              </div>
            </>
          ) : (
            <p className="text-sm text-green-600 font-medium">All sessions completed!</p>
          )}
        </Link>

        {/* Pending Tasks */}
        <Link
          href={`/dashboard/pairings/${pairing.id}`}
          className="card card-hover p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-yellow flex items-center justify-center">
              <Icon name="clipboard-check" size={18} className="text-primary" />
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase">Tasks</p>
          </div>
          <p className="text-3xl font-bold">{pendingTasks.length}</p>
          <p className="text-xs text-gray-500 mt-1">
            {pendingTasks.length === 0 ? "All caught up!" : "pending tasks"}
          </p>
          {docsNeedingRevision.length > 0 && (
            <p className="text-xs text-amber-600 mt-1 font-medium">
              {docsNeedingRevision.length} doc(s) need revision
            </p>
          )}
        </Link>

        {/* Document Progress */}
        <Link
          href={`/dashboard/pairings/${pairing.id}`}
          className="card card-hover p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-lavender flex items-center justify-center">
              <Icon name="document" size={18} className="text-primary" />
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase">Documents</p>
          </div>
          <p className="text-3xl font-bold">
            {uploadedCount}<span className="text-lg text-gray-400 font-normal">/{totalChecklist}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">checklist items uploaded</p>
          <p className="text-xs text-green-600 mt-0.5">{approvedDocs} approved</p>
        </Link>
      </div>

      {/* Session Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Session Progress</h3>
          <span className="text-sm text-gray-500">{completed}/10 completed</span>
        </div>
        <ProgressBar
          value={(completed / 10) * 100}
          size="lg"
          className="mb-6"
        />

        {/* Phase timeline — clickable, expands inline */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {Object.entries(PHASES).map(([key, phase]) => {
            const phaseSessions = pairing.sessions.filter((s) => s.phase === key);
            const phaseCompleted = phaseSessions.every((s) => s.status === "completed");
            const phaseActive =
              phaseSessions.some((s) => s.status !== "completed") &&
              phaseSessions.some(
                (s) => s.status === "completed" || s === nextSession
              );
            const isExpanded = expandedPhase === key;
            const phaseIconName = PHASE_ICONS[key] || "puzzle";

            return (
              <button
                key={key}
                onClick={() => setExpandedPhase(isExpanded ? null : key)}
                className={`text-center p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                  isExpanded
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                    : phaseCompleted
                    ? "bg-success-light border-green-200 hover:border-green-300"
                    : phaseActive
                    ? "bg-brand-blue-soft border-[var(--primary)]"
                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex justify-center">
                  <Icon name={phaseIconName} size={20} className={isExpanded ? "text-white" : ""} />
                </div>
                <p className={`text-xs font-medium mt-1 ${isExpanded ? "text-white" : ""}`}>{phase.label}</p>
                <p className={`text-[10px] mt-0.5 ${isExpanded ? "text-white/70" : "text-gray-400"}`}>
                  {phaseSessions.filter((s) => s.status === "completed").length}/{phaseSessions.length} sessions
                </p>
              </button>
            );
          })}
        </div>

        {/* Expanded phase detail */}
        {expandedPhase && (() => {
          const phaseInfo = PHASES[expandedPhase as keyof typeof PHASES];
          const phaseIconName = PHASE_ICONS[expandedPhase] || "puzzle";
          const phaseSessions = pairing.sessions
            .filter((s) => s.phase === expandedPhase)
            .sort((a, b) => a.sessionNum - b.sessionNum);

          return (
            <div className="mt-4 border-t border-gray-100 pt-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Icon name={phaseIconName} size={16} /> {phaseInfo.label} Phase
                </h4>
                <Link
                  href={`/dashboard/pairings/${pairing.id}`}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Open full details &rarr;
                </Link>
              </div>
              {phaseSessions.map((session) => {
                const currItem = CURRICULUM.find((c) => c.sessionNum === session.sessionNum);
                const isCompleted = session.status === "completed";
                const isNext = session === nextSession;

                return (
                  <Link
                    key={session.sessionNum}
                    href={`/dashboard/pairings/${pairing.id}`}
                    className={`block p-4 rounded-lg border transition hover:shadow-md cursor-pointer ${
                      isCompleted
                        ? "bg-green-50 border-green-200 hover:border-green-300"
                        : isNext
                        ? "bg-blue-50 border-blue-200 hover:border-blue-300"
                        : "bg-gray-50 border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          isCompleted
                            ? "bg-green-100 text-green-600"
                            : isNext
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-200 text-gray-400"
                        }`}>
                          {isCompleted ? <Icon name="check" size={16} /> : session.sessionNum}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            Session {session.sessionNum}: {session.topic}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {currItem?.duration || "75 Min"}
                          </p>
                          {session.scheduledAt && (
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                              <Icon name="calendar" size={12} />
                              {new Date(session.scheduledAt).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                          {/* Show deliverables if any */}
                          {currItem && currItem.docChecklist.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {currItem.docChecklist.map((item, i) => {
                                const uploaded = checklistItemUploaded(item, pairing.documents);
                                return (
                                  <Badge
                                    key={i}
                                    variant={uploaded ? "success" : "neutral"}
                                  >
                                    {uploaded ? <Icon name="check" size={10} className="inline mr-0.5" /> : "○"} {item}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          isCompleted
                            ? "success"
                            : isNext && session.status === "scheduled"
                            ? "info"
                            : "neutral"
                        }
                      >
                        {session.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines & Tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">My Tasks</h3>
            <span className="text-xs text-gray-400">{pendingTasks.length} pending</span>
          </div>

          {/* Upcoming deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs font-semibold text-red-700 uppercase mb-2">Upcoming Deadlines</p>
              {upcomingDeadlines.slice(0, 3).map((task) => {
                const dueDate = new Date(task.dueDate!);
                const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={task.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-700">{task.title}</span>
                    <span className={`text-xs font-medium ${
                      daysLeft <= 1 ? "text-red-600" : daysLeft <= 3 ? "text-amber-600" : "text-gray-500"
                    }`}>
                      {daysLeft <= 0 ? "Overdue!" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {pendingTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No pending tasks</p>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Document Checklist */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Document Checklist</h3>
            <Link
              href={`/dashboard/pairings/${pairing.id}`}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              View all
            </Link>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-4">
            <ProgressBar
              value={totalChecklist > 0 ? (uploadedCount / totalChecklist) * 100 : 0}
              size="sm"
              className="flex-1"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {uploadedCount}/{totalChecklist}
            </span>
          </div>

          {/* Docs needing revision alert */}
          {docsNeedingRevision.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-800">
                {docsNeedingRevision.length} document(s) need revision
              </p>
              <div className="mt-1 space-y-0.5">
                {docsNeedingRevision.map((d) => (
                  <p key={d.id} className="text-xs text-amber-700">- {d.name}</p>
                ))}
              </div>
            </div>
          )}

          {/* Per-phase checklist */}
          <div className="space-y-3">
            {CURRICULUM.map((session) => {
              if (session.docChecklist.length === 0) return null;
              const phaseInfo = PHASES[session.phase as keyof typeof PHASES];
              const phaseIconName = PHASE_ICONS[session.phase] || "puzzle";
              const sessionDone = pairing.sessions.find(
                (s) => s.sessionNum === session.sessionNum
              )?.status === "completed";
              const itemsUploaded = session.docChecklist.filter((item) =>
                checklistItemUploaded(item, pairing.documents)
              ).length;

              return (
                <div key={session.sessionNum} className="border-b border-gray-50 pb-2 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Icon name={phaseIconName} size={12} /> S{session.sessionNum}
                    </span>
                    <span className="text-xs text-gray-400">
                      {itemsUploaded}/{session.docChecklist.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {session.docChecklist.map((item, i) => {
                      const uploaded = checklistItemUploaded(item, pairing.documents);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {uploaded ? (
                            <Icon name="check" size={12} className="text-green-500" />
                          ) : (
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-gray-300">
                              <circle cx="12" cy="12" r="9" />
                            </svg>
                          )}
                          <span className={`text-xs ${uploaded ? "text-gray-600" : "text-gray-400"}`}>
                            {item}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* View full journey */}
      <div className="text-center">
        <Link
          href={`/dashboard/pairings/${pairing.id}`}
          className="btn-primary inline-flex items-center gap-2"
        >
          View Full Journey Details
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: Task }) {
  const [completing, setCompleting] = useState(false);

  async function markComplete() {
    setCompleting(true);
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    window.location.href = `/dashboard`;
  }

  return (
    <div className="flex items-center justify-between p-3 card-hover rounded-lg border-l-4 border-l-[var(--primary)]">
      <div>
        <p className="text-sm font-medium">{task.title}</p>
        {task.dueDate && (
          <p className="text-xs text-gray-400 mt-0.5">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </p>
        )}
      </div>
      <button
        onClick={markComplete}
        disabled={completing}
        className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium hover:bg-green-200 transition disabled:opacity-50 inline-flex items-center gap-1"
      >
        <Icon name="clipboard-check" size={12} />
        {completing ? "..." : "Complete"}
      </button>
    </div>
  );
}
