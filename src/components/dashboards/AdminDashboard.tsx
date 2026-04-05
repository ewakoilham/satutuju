"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import { ConfirmModal } from "@/components/ui/Modal";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  mentorProfileComplete?: boolean;
}

interface Pairing {
  id: string;
  status: string;
  mentor?: User;
  mentee?: User;
  targetProgram?: string;
  sessions: Array<{ status: string }>;
  _count: { documents: number; tasks: number };
}

interface MentorFeedbackItem {
  sessionNum: number;
  menteeName: string;
  mentorRating: number | null;
  menteeFeedback: string;
  pairingId: string;
  updatedAt: string;
}

interface MentorSummary {
  mentorId: string;
  mentorName: string;
  avgRating: number;
  totalRatings: number;
  feedbackCount: number;
  pairingCount: number;
  feedbackItems: MentorFeedbackItem[];
}

interface FeedbackItem {
  sessionNum: number;
  mentorName: string;
  menteeName: string;
  mentorRating: number | null;
  menteeFeedback: string;
  pairingId: string;
  updatedAt: string;
}

type AdminTab = "pairings" | "quality";
type PairingsTab = "active" | "archived";

export default function AdminDashboard() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [mentors, setMentors] = useState<User[]>([]);
  const [mentees, setMentees] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<AdminTab>("pairings");
  const [pairingsTab, setPairingsTab] = useState<PairingsTab>("active");
  const [mentorSummaries, setMentorSummaries] = useState<MentorSummary[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<MentorSummary | null>(null);
  const [newPairing, setNewPairing] = useState({
    mentorId: "",
    menteeId: "",
  });
  const [loading, setLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "danger";
  }>({ open: false, title: "", description: "", onConfirm: () => {}, variant: "default" });

  const fetchData = useCallback(async () => {
    try {
      const [pRes, mentorRes, menteeRes, fbRes] = await Promise.all([
        fetch("/api/pairings"),
        fetch("/api/users?role=mentor"),
        fetch("/api/users?role=mentee"),
        fetch("/api/admin/feedback"),
      ]);
      const [pData, mentorData, menteeData, fbData] = await Promise.all([
        pRes.json(),
        mentorRes.json(),
        menteeRes.json(),
        fbRes.json(),
      ]);
      setPairings(pData.pairings || []);
      setMentors(mentorData.users || []);
      setMentees(menteeData.users || []);
      setMentorSummaries(fbData.mentorSummaries || []);
      setRecentFeedback(fbData.recentFeedback || []);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [replacingPairingId, setReplacingPairingId] = useState<string | null>(null);
  const [replaceMentorId, setReplaceMentorId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const createFormRef = useRef<HTMLFormElement>(null);

  async function createPairing(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPairing),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create pairing");
        setCreating(false);
        return;
      }
      setShowCreate(false);
      setNewPairing({ mentorId: "", menteeId: "" });
      fetchData();
    } catch {
      setCreateError("Network error. Please try again.");
    }
    setCreating(false);
  }

  // Auto-scroll to create form on mobile
  useEffect(() => {
    if (showCreate && createFormRef.current) {
      createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showCreate]);

  async function replaceMentor(pairingId: string) {
    if (!replaceMentorId) return;
    setActionLoading(pairingId);
    try {
      const res = await fetch(`/api/pairings/${pairingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId: replaceMentorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to replace mentor");
      } else {
        setReplacingPairingId(null);
        setReplaceMentorId("");
        fetchData();
      }
    } catch {
      alert("Network error");
    }
    setActionLoading(null);
  }

  async function removePairing(pairingId: string, mentorName: string, menteeName: string) {
    setConfirmModal({
      open: true,
      title: "Cancel Pairing",
      description: `Cancel the pairing between ${mentorName} and ${menteeName}? This cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setActionLoading(pairingId);
        try {
          const res = await fetch(`/api/pairings/${pairingId}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "Failed to cancel pairing");
          } else {
            fetchData();
          }
        } catch {
          alert("Network error");
        }
        setActionLoading(null);
      },
    });
  }

  async function reopenPairing(pairingId: string) {
    setActionLoading(pairingId);
    try {
      const res = await fetch(`/api/pairings/${pairingId}`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to reopen pairing");
      } else {
        fetchData();
      }
    } catch {
      alert("Network error");
    }
    setActionLoading(null);
  }

  async function permanentlyDeletePairing(pairingId: string, mentorName: string, menteeName: string) {
    setConfirmModal({
      open: true,
      title: "Permanently Delete Pairing",
      description: `Permanently delete the pairing between ${mentorName} and ${menteeName}?\n\nThis will delete ALL associated sessions, documents, and tasks and CANNOT be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        setActionLoading(pairingId);
        try {
          const res = await fetch(`/api/pairings/${pairingId}?permanent=true`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "Failed to delete pairing");
          } else {
            fetchData();
          }
        } catch {
          alert("Network error");
        }
        setActionLoading(null);
      },
    });
  }

  const completedSessions = (p: Pairing) =>
    p.sessions.filter((s) => s.status === "completed").length;

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage mentors, mentees, and pairings
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary"
        >
          <Icon name="plus" size={16} />
          New Pairing
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Mentors"
          value={mentors.length}
          icon="users"
          accent="blue"
          href="/dashboard/users?filter=mentor"
        />
        <StatCard
          label="Total Mentees"
          value={mentees.length}
          icon="graduation"
          accent="lavender"
          href="/dashboard/users?filter=mentee"
        />
        <StatCard
          label="Active Pairings"
          value={pairings.filter((p) => p.status === "active").length}
          icon="link"
          accent="green"
          href="/dashboard/pairings"
        />
        <StatCard
          label="Completed"
          value={pairings.filter((p) => p.status === "completed").length}
          icon="check"
          accent="yellow"
          href="/dashboard/pairings"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: "pairings" as AdminTab, label: "Pairings", icon: "link" },
          { key: "quality" as AdminTab, label: "Quality Control", icon: "star" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition ${
              tab === t.key
                ? "bg-brand-blue-soft text-primary shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "quality" && (
        <div className="space-y-6">
          {/* Mentor Rating Cards */}
          <div>
            <h3 className="font-semibold mb-3 font-[family-name:var(--font-heading)]">Mentor Performance</h3>
            {mentorSummaries.length === 0 ? (
              <div className="card px-6 py-8 text-center text-gray-400 text-sm">
                No ratings or feedback yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentorSummaries.map((m) => (
                  <div
                    key={m.mentorId}
                    onClick={() => m.feedbackCount > 0 && setSelectedMentor(m)}
                    className={`card transition ${m.feedbackCount > 0 ? "cursor-pointer hover:border-primary hover:shadow-sm" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.mentorName} size="sm" />
                        <h4 className="font-medium">{m.mentorName}</h4>
                      </div>
                      <Badge variant="neutral">
                        {m.pairingCount} mentee{m.pairingCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl font-bold text-primary">
                        {m.avgRating > 0 ? m.avgRating : "\u2014"}
                      </div>
                      <div>
                        {m.avgRating > 0 && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span
                                key={s}
                                className={`text-sm ${
                                  s <= Math.round(m.avgRating)
                                    ? "text-amber-400"
                                    : "text-gray-300"
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          {m.totalRatings} rating{m.totalRatings !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {m.feedbackCount} feedback comment{m.feedbackCount !== 1 ? "s" : ""}
                      </div>
                      {m.feedbackCount > 0 && (
                        <span className="text-xs text-primary font-medium">View all →</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Feedback */}
          <div>
            <h3 className="font-semibold mb-3 font-[family-name:var(--font-heading)]">Recent Mentee Feedback</h3>
            {recentFeedback.length === 0 ? (
              <div className="card px-6 py-8 text-center text-gray-400 text-sm">
                No feedback yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentFeedback.map((fb, i) => (
                  <div
                    key={i}
                    className="card cursor-pointer hover:border-gray-300 transition"
                    onClick={() =>
                      (window.location.href = `/dashboard/pairings/${fb.pairingId}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar name={fb.menteeName} size="sm" />
                          <span className="text-sm font-medium">
                            {fb.menteeName}
                          </span>
                          <Icon name="arrow-right" size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-400">
                            {fb.mentorName}
                          </span>
                          <Badge variant="neutral">
                            Session {fb.sessionNum}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 ml-9">
                          {fb.menteeFeedback}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {fb.mentorRating && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-amber-400">
                              {Array.from(
                                { length: fb.mentorRating },
                                () => "★"
                              ).join("")}
                            </span>
                            <span className="text-xs text-gray-400">
                              {fb.mentorRating}/5
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(fb.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "pairings" && <>
      {/* Pairings Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: "active" as PairingsTab, label: "Active" },
          { key: "archived" as PairingsTab, label: "Archived" },
        ] as { key: PairingsTab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setPairingsTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              pairingsTab === t.key
                ? "bg-brand-blue-soft text-primary shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-white/60 text-gray-500">
              {t.key === "active"
                ? pairings.filter((p) => p.status === "active").length
                : pairings.filter((p) => p.status !== "active").length}
            </span>
          </button>
        ))}
      </div>

      {/* Create Pairing Form */}
      {showCreate && pairingsTab === "active" && (
        <form
          ref={createFormRef}
          onSubmit={createPairing}
          className="card space-y-4"
        >
          <h3 className="font-semibold font-[family-name:var(--font-heading)]">Create New Pairing</h3>
          {createError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mentor
              </label>
              <select
                value={newPairing.mentorId}
                onChange={(e) =>
                  setNewPairing({ ...newPairing, mentorId: e.target.value })
                }
                required
                className="input-field"
              >
                <option value="">Select mentor...</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.mentorProfileComplete ? "✓" : "⚠"} {m.name} ({m.email}){m.mentorProfileComplete ? "" : " — profile incomplete"}
                  </option>
                ))}
              </select>
              {/* Profile status legend */}
              {newPairing.mentorId && (() => {
                const selected = mentors.find((m) => m.id === newPairing.mentorId);
                if (!selected) return null;
                return selected.mentorProfileComplete ? (
                  <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                    <Icon name="check" size={12} /> Profile complete
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <Icon name="alert" size={12} /> Profile not yet filled — consider asking the mentor to complete it before pairing
                  </p>
                );
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mentee
              </label>
              {(() => {
                const activeMenteeIds = new Set(
                  pairings.filter((p) => p.status === "active").map((p) => p.mentee?.id).filter(Boolean)
                );
                const availableMentees = mentees.filter((m) => !activeMenteeIds.has(m.id));
                return (
                  <select
                    value={newPairing.menteeId}
                    onChange={(e) =>
                      setNewPairing({ ...newPairing, menteeId: e.target.value })
                    }
                    required
                    className="input-field"
                  >
                    <option value="">Select mentee...</option>
                    {availableMentees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="btn-primary"
            >
              {creating ? "Creating..." : "Create Pairing"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Pairings Table */}
      {(() => {
        const visiblePairings = pairings.filter((p) =>
          pairingsTab === "active" ? p.status === "active" : p.status !== "active"
        );
        return (
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold font-[family-name:var(--font-heading)]">
            {pairingsTab === "active" ? "Active Pairings" : "Archived Pairings"}
          </h3>
        </div>
        {visiblePairings.length === 0 ? (
          <div className="card mx-6 my-8 text-center text-gray-400 text-sm">
            <Icon name="link" size={32} className="mx-auto text-gray-300 mb-3" />
            {pairingsTab === "active"
              ? "No active pairings. Create one to get started."
              : "No archived pairings."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-left">
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">
                    Mentor
                  </th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">
                    Mentee
                  </th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">
                    Program
                  </th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">
                    Progress
                  </th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePairings.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-50 cursor-pointer hover:bg-gray-50/50 transition"
                    onClick={() => window.location.href = `/dashboard/pairings/${p.id}`}
                  >
                    <td className="px-3 sm:px-6 py-3">
                      <span className="flex items-center gap-2 flex-wrap">
                        {p.mentor?.name && <Avatar name={p.mentor.name} size="sm" />}
                        <span>{p.mentor?.name}</span>
                        {(() => {
                          const mentor = mentors.find((m) => m.id === p.mentor?.id);
                          if (!mentor) return null;
                          return mentor.mentorProfileComplete ? (
                            <span title="Profile complete" className="text-success">
                              <Icon name="check" size={13} />
                            </span>
                          ) : (
                            <span title="Profile incomplete" className="text-amber-500">
                              <Icon name="alert" size={13} />
                            </span>
                          );
                        })()}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className="flex items-center gap-2">
                        {p.mentee?.name && <Avatar name={p.mentee.name} size="sm" />}
                        {p.mentee?.name}
                        {p.mentee?.id && (
                          <a
                            href={`/dashboard/profile/${p.mentee.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Profile
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 text-gray-500">
                      {p.targetProgram || "-"}
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={(completedSessions(p) / 10) * 100}
                          size="sm"
                          className="w-20"
                        />
                        <span className="text-xs text-gray-500">
                          {completedSessions(p)}/10
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <Badge
                        variant={
                          p.status === "active"
                            ? "success"
                            : p.status === "completed"
                            ? "info"
                            : p.status === "cancelled"
                            ? "danger"
                            : "neutral"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* View icon */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/pairings/${p.id}`; }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                          title="View pairing"
                        >
                          <Icon name="eye" size={16} className="text-primary" />
                        </button>
                        {p.status === "active" ? (
                          <>
                            {replacingPairingId === p.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={replaceMentorId}
                                  onChange={(e) => setReplaceMentorId(e.target.value)}
                                  className="input-field text-xs !py-1 !px-1.5"
                                >
                                  <option value="">New mentor...</option>
                                  {mentors.filter((m) => m.id !== p.mentor?.id).map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => replaceMentor(p.id)}
                                  disabled={!replaceMentorId || actionLoading === p.id}
                                  className="btn-primary text-xs !px-2 !py-1"
                                >
                                  {actionLoading === p.id ? "..." : "OK"}
                                </button>
                                <button
                                  onClick={() => { setReplacingPairingId(null); setReplaceMentorId(""); }}
                                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                                >
                                  <Icon name="x" size={14} />
                                </button>
                              </div>
                            ) : (
                              /* Replace icon */
                              <button
                                onClick={(e) => { e.stopPropagation(); setReplacingPairingId(p.id); setReplaceMentorId(""); }}
                                className="p-1.5 rounded-lg hover:bg-amber-50 transition"
                                title="Replace mentor"
                              >
                                <Icon name="refresh" size={16} className="text-amber-500" />
                              </button>
                            )}
                            {/* Remove icon */}
                            <button
                              onClick={(e) => { e.stopPropagation(); removePairing(p.id, p.mentor?.name || "mentor", p.mentee?.name || "mentee"); }}
                              disabled={actionLoading === p.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                              title="Remove pairing"
                            >
                              {actionLoading === p.id
                                ? <span className="text-xs text-red-400">...</span>
                                : <Icon name="trash" size={16} className="text-red-400" />
                              }
                            </button>
                          </>
                        ) : (() => {
                          // Archived pairing actions
                          const activeMenteeIds = new Set(
                            pairings.filter((ap) => ap.status === "active").map((ap) => ap.mentee?.id).filter(Boolean)
                          );
                          const canReopen = !activeMenteeIds.has(p.mentee?.id);
                          return (
                            <>
                              {/* Reopen icon */}
                              <button
                                onClick={(e) => { e.stopPropagation(); if (canReopen) reopenPairing(p.id); }}
                                disabled={!canReopen || actionLoading === p.id}
                                className={`p-1.5 rounded-lg transition disabled:opacity-40 ${canReopen ? "hover:bg-green-50" : "cursor-not-allowed"}`}
                                title={canReopen ? "Reopen pairing" : "Cannot reopen \u2014 mentee already has an active pairing"}
                              >
                                {actionLoading === p.id
                                  ? <span className="text-xs text-green-500">...</span>
                                  : <Icon name="upload" size={16} className="text-green-500" />
                                }
                              </button>
                              {/* Permanently delete icon */}
                              <button
                                onClick={(e) => { e.stopPropagation(); permanentlyDeletePairing(p.id, p.mentor?.name || "mentor", p.mentee?.name || "mentee"); }}
                                disabled={actionLoading === p.id}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                                title="Permanently delete pairing"
                              >
                                <Icon name="trash" size={16} className="text-red-600" />
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        );
      })()}
      </>}

      {/* Mentor Feedback Modal */}
      {selectedMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary-900/30 backdrop-blur-sm" onClick={() => setSelectedMentor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-lg font-[family-name:var(--font-heading)]">{selectedMentor.mentorName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-primary">{selectedMentor.avgRating}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-sm ${s <= Math.round(selectedMentor.avgRating) ? "text-amber-400" : "text-gray-300"}`}>★</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">avg from {selectedMentor.totalRatings} rating{selectedMentor.totalRatings !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMentor(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
                <Icon name="x" size={20} />
              </button>
            </div>
            {/* Feedback list */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {selectedMentor.feedbackItems.map((fb, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition cursor-pointer"
                  onClick={() => { setSelectedMentor(null); window.location.href = `/dashboard/pairings/${fb.pairingId}`; }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={fb.menteeName} size="sm" />
                      <span className="text-sm font-medium">{fb.menteeName}</span>
                      <Badge variant="neutral">Session {fb.sessionNum}</Badge>
                    </div>
                    {fb.mentorRating && (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xs ${s <= fb.mentorRating! ? "text-amber-400" : "text-gray-300"}`}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{fb.menteeFeedback}</p>
                  <p className="text-xs text-gray-400 mt-2">{new Date(fb.updatedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        variant={confirmModal.variant}
        confirmLabel={confirmModal.variant === "danger" ? "Delete" : "Confirm"}
      />
    </div>
  );
}
