"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

interface Pairing {
  id: string;
  status: string;
  targetProgram?: string;
  mentee: { id: string; name: string; email: string };
  sessions: Array<{ sessionNum: number; status: string; phase: string; menteeEnergy?: number }>;
  _count: { documents: number; tasks: number };
}

const PHASE_COLORS: Record<string, string> = {
  discovery: "bg-brand-blue-soft text-primary",
  planning: "bg-brand-yellow text-primary-800",
  writing: "bg-brand-lavender text-primary-700",
  execution: "bg-primary-100 text-primary-700",
  closing: "bg-success-light text-success",
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

  if (loading) return <SkeletonDashboard />;

  if (pairings.length === 0) {
    return (
      <EmptyState
        icon="graduation"
        title="No mentees assigned yet"
        description="The admin will pair you with mentees soon."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">My Mentees</h1>
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
              className="card-hover block"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <Avatar name={p.mentee.name} size="lg" />
                  <div>
                    <h3 className="text-lg font-semibold">{p.mentee.name}</h3>
                    <p className="text-sm text-gray-500">{p.mentee.email}</p>
                    {p.targetProgram && (
                      <p className="text-sm text-[var(--primary)] mt-1">
                        {p.targetProgram}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={p.status === "active" ? "success" : "neutral"}>
                  {p.status}
                </Badge>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Session Progress</span>
                  <span>{completed}/10</span>
                </div>
                <ProgressBar value={(completed / 10) * 100} />
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
                  <Badge variant="danger">Low energy</Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
