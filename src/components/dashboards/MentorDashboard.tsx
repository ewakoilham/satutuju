"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Pairing {
  id: string;
  status: string;
  targetProgram?: string;
  mentee: { id: string; name: string; email: string };
  sessions: Array<{ sessionNum: number; status: string; phase: string; menteeEnergy?: number }>;
  _count: { documents: number; tasks: number };
}

const PHASE_COLORS: Record<string, string> = {
  discovery: "bg-blue-100 text-blue-700",
  planning: "bg-amber-100 text-amber-700",
  writing: "bg-purple-100 text-purple-700",
  execution: "bg-orange-100 text-orange-700",
  closing: "bg-green-100 text-green-700",
};

export default function MentorDashboard() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pairings")
      .then((r) => r.json())
      .then((d) => setPairings(d.pairings || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  if (pairings.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">🎓</p>
        <h2 className="text-xl font-semibold">No mentees assigned yet</h2>
        <p className="text-gray-500 mt-2">
          The admin will pair you with mentees soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Mentees</h1>
        <p className="text-gray-500 text-sm mt-1">
          Track progress and guide your mentees
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pairings.map((p) => {
          const completed = p.sessions.filter(
            (s) => s.status === "completed"
          ).length;
          const currentSession =
            p.sessions.find((s) => s.status !== "completed") || p.sessions[9];
          const latestEnergy = [...p.sessions]
            .reverse()
            .find((s) => s.menteeEnergy)?.menteeEnergy;

          return (
            <Link
              key={p.id}
              href={`/dashboard/pairings/${p.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition block"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{p.mentee.name}</h3>
                  <p className="text-sm text-gray-500">{p.mentee.email}</p>
                  {p.targetProgram && (
                    <p className="text-sm text-[var(--primary)] mt-1">
                      {p.targetProgram}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    p.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Session Progress</span>
                  <span>{completed}/10</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--primary)] rounded-full transition-all"
                    style={{ width: `${(completed / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current phase & stats */}
              <div className="flex items-center gap-3 flex-wrap">
                {currentSession && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      PHASE_COLORS[currentSession.phase] || "bg-gray-100"
                    }`}
                  >
                    Session {currentSession.sessionNum}: {currentSession.phase}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {p._count.documents} docs
                </span>
                <span className="text-xs text-gray-400">
                  {p._count.tasks} tasks
                </span>
                {latestEnergy && latestEnergy <= 2 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
                    Low energy
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
