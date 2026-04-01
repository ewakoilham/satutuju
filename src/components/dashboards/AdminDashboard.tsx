"use client";

import { useState, useEffect, useCallback } from "react";
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

interface MentorSummary {
  mentorId: string;
  mentorName: string;
  avgRating: number;
  totalRatings: number;
  feedbackCount: number;
  pairingCount: number;
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

export default function AdminDashboard() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [mentors, setMentors] = useState<User[]>([]);
  const [mentees, setMentees] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<AdminTab>("pairings");
  const [mentorSummaries, setMentorSummaries] = useState<MentorSummary[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [newPairing, setNewPairing] = useState({
    mentorId: "",
    menteeId: "",
    targetProgram: "",
  });

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function createPairing(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/pairings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPairing),
    });
    setShowCreate(false);
    setNewPairing({ mentorId: "", menteeId: "", targetProgram: "" });
    fetchData();
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
                    className="bg-white rounded-xl border border-gray-200 p-5"
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
                    <div className="text-xs text-gray-500">
                      {m.feedbackCount} feedback comment{m.feedbackCount !== 1 ? "s" : ""}
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
      {/* Create Pairing Form */}
      {showCreate && (
        <form
          onSubmit={createPairing}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <h3 className="font-semibold">Create New Pairing</h3>
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
              <select
                value={newPairing.menteeId}
                onChange={(e) =>
                  setNewPairing({ ...newPairing, menteeId: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select mentee...</option>
                {mentees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
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
              className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              Create Pairing
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold">All Pairings</h3>
        </div>
        {pairings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No pairings yet. Create one to get started.
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
                  <th className="px-3 sm:px-6 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {pairings.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-50 cursor-pointer hover:bg-gray-50 transition"
                    onClick={() => window.location.href = `/dashboard/pairings/${p.id}`}
                  >
                    <td className="px-3 sm:px-6 py-3">{p.mentor?.name}</td>
                    <td className="px-3 sm:px-6 py-3">{p.mentee?.name}</td>
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
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3">
                      <span className="text-[var(--primary)] text-sm">
                        View &rarr;
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
