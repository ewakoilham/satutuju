"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
    targetProgram: "",
  });

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
      setNewPairing({ mentorId: "", menteeId: "", targetProgram: "" });
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
    if (!window.confirm(`Cancel the pairing between ${mentorName} and ${menteeName}? This cannot be undone.`)) return;
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
    if (!window.confirm(
      `Permanently delete the pairing between ${mentorName} and ${menteeName}?\n\nThis will delete ALL associated sessions, documents, and tasks and CANNOT be undone.`
    )) return;
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
  }

  const completedSessions = (p: Pairing) =>
    p.sessions.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage mentors, mentees, and pairings
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          + New Pairing
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Mentors", value: mentors.length, color: "blue" },
          { label: "Total Mentees", value: mentees.length, color: "purple" },
          { label: "Active Pairings", value: pairings.filter((p) => p.status === "active").length, color: "green" },
          { label: "Completed", value: pairings.filter((p) => p.status === "completed").length, color: "amber" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-200">
        {[
          { key: "pairings" as AdminTab, label: "Pairings" },
          { key: "quality" as AdminTab, label: "Quality Control" },
        ].map((t) => (
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
          </button>
        ))}
      </div>

      {tab === "quality" && (
        <div className="space-y-6">
          {/* Mentor Rating Cards */}
          <div>
            <h3 className="font-semibold mb-3">Mentor Performance</h3>
            {mentorSummaries.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center text-gray-400 text-sm">
                No ratings or feedback yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mentorSummaries.map((m) => (
                  <div
                    key={m.mentorId}
                    onClick={() => m.feedbackCount > 0 && setSelectedMentor(m)}
                    className={`bg-white rounded-xl border border-gray-200 p-5 transition ${m.feedbackCount > 0 ? "cursor-pointer hover:border-[var(--primary)] hover:shadow-sm" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{m.mentorName}</h4>
                      <span className="text-xs text-gray-400">
                        {m.pairingCount} mentee{m.pairingCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl font-bold text-[var(--primary)]">
                        {m.avgRating > 0 ? m.avgRating : "—"}
                      </div>
                      <div>
                        {m.avgRating > 0 && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span
                                key={s}
                                className={`text-sm ${
                                  s <= Math.round(m.avgRating)
                                    ? "text-yellow-500"
                                    : "text-gray-200"
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
                        <span className="text-xs text-[var(--primary)]">View all →</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Feedback */}
          <div>
            <h3 className="font-semibold mb-3">Recent Mentee Feedback</h3>
            {recentFeedback.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center text-gray-400 text-sm">
                No feedback yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentFeedback.map((fb, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 transition"
                    onClick={() =>
                      (window.location.href = `/dashboard/pairings/${fb.pairingId}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {fb.menteeName}
                          </span>
                          <span className="text-xs text-gray-400">
                            &rarr; {fb.mentorName}
                          </span>
                          <span className="text-xs text-gray-300">
                            Session {fb.sessionNum}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {fb.menteeFeedback}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {fb.mentorRating && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm">
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
      <div className="flex gap-1 border-b border-gray-100">
        {([
          { key: "active" as PairingsTab, label: "Active" },
          { key: "archived" as PairingsTab, label: "Archived" },
        ] as { key: PairingsTab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setPairingsTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              pairingsTab === t.key
                ? "bg-white border border-b-white border-gray-200 text-[var(--primary)] -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <h3 className="font-semibold">Create New Pairing</h3>
          {createError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select mentor...</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Program
              </label>
              <input
                type="text"
                value={newPairing.targetProgram}
                onChange={(e) =>
                  setNewPairing({
                    ...newPairing,
                    targetProgram: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g. Masters in Education, UK"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Pairing"}
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

      {/* Pairings Table */}
      {(() => {
        const visiblePairings = pairings.filter((p) =>
          pairingsTab === "active" ? p.status === "active" : p.status !== "active"
        );
        return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold">
            {pairingsTab === "active" ? "Active Pairings" : "Archived Pairings"}
          </h3>
        </div>
        {visiblePairings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {pairingsTab === "active"
              ? "No active pairings. Create one to get started."
              : "No archived pairings."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
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
                    className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => window.location.href = `/dashboard/pairings/${p.id}`}
                  >
                    <td className="px-3 sm:px-6 py-3">{p.mentor?.name}</td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className="flex items-center gap-2">
                        {p.mentee?.name}
                        {p.mentee?.id && (
                          <a
                            href={`/dashboard/profile/${p.mentee.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[var(--primary)] hover:underline font-medium"
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
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--primary)] rounded-full"
                            style={{
                              width: `${(completedSessions(p) / 10) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {completedSessions(p)}/10
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          p.status === "active"
                            ? "bg-green-100 text-green-700"
                            : p.status === "completed"
                            ? "bg-blue-100 text-blue-700"
                            : p.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* View icon */}
                        <button
                          onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/pairings/${p.id}`; }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                          title="View pairing"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {p.status === "active" ? (
                          <>
                            {replacingPairingId === p.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={replaceMentorId}
                                  onChange={(e) => setReplaceMentorId(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-1.5 py-1"
                                >
                                  <option value="">New mentor...</option>
                                  {mentors.filter((m) => m.id !== p.mentor?.id).map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => replaceMentor(p.id)}
                                  disabled={!replaceMentorId || actionLoading === p.id}
                                  className="text-xs bg-[var(--primary)] text-white px-2 py-1 rounded hover:opacity-90 disabled:opacity-50"
                                >
                                  {actionLoading === p.id ? "..." : "OK"}
                                </button>
                                <button
                                  onClick={() => { setReplacingPairingId(null); setReplaceMentorId(""); }}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              /* Replace icon */
                              <button
                                onClick={(e) => { e.stopPropagation(); setReplacingPairingId(p.id); setReplaceMentorId(""); }}
                                className="p-1.5 rounded-lg hover:bg-amber-50 transition"
                                title="Replace mentor"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
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
                                : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
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
                                title={canReopen ? "Reopen pairing" : "Cannot reopen — mentee already has an active pairing"}
                              >
                                {actionLoading === p.id
                                  ? <span className="text-xs text-green-500">...</span>
                                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                                    </svg>
                                }
                              </button>
                              {/* Permanently delete icon */}
                              <button
                                onClick={(e) => { e.stopPropagation(); permanentlyDeletePairing(p.id, p.mentor?.name || "mentor", p.mentee?.name || "mentee"); }}
                                disabled={actionLoading === p.id}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                                title="Permanently delete pairing"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedMentor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-lg">{selectedMentor.mentorName}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-[var(--primary)]">{selectedMentor.avgRating}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-sm ${s <= Math.round(selectedMentor.avgRating) ? "text-yellow-500" : "text-gray-200"}`}>★</span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">avg from {selectedMentor.totalRatings} rating{selectedMentor.totalRatings !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <button onClick={() => setSelectedMentor(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Feedback list */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {selectedMentor.feedbackItems.map((fb, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => { setSelectedMentor(null); window.location.href = `/dashboard/pairings/${fb.pairingId}`; }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{fb.menteeName}</span>
                      <span className="text-xs text-gray-400">· Session {fb.sessionNum}</span>
                    </div>
                    {fb.mentorRating && (
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xs ${s <= fb.mentorRating! ? "text-yellow-500" : "text-gray-200"}`}>★</span>
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
    </div>
  );
}
