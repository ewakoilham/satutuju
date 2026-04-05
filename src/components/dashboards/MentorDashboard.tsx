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

const REQUIRED_PROFILE_FIELDS = [
  "fullName", "city", "undergradUniversity", "postgradUniversity",
  "fundingScheme", "currentField", "weeklyHours", "availability",
  "personality", "mentorStyle", "workStyle", "communicationStyle", "primaryRoles",
];

function profileCompleteness(profile: Record<string, unknown> | null): { complete: boolean; filled: number; total: number } {
  if (!profile) return { complete: false, filled: 0, total: REQUIRED_PROFILE_FIELDS.length };
  let filled = 0;
  for (const f of REQUIRED_PROFILE_FIELDS) {
    const v = profile[f];
    if (Array.isArray(v) ? v.length > 0 : (v !== null && v !== undefined && v !== "")) filled++;
  }
  return { complete: filled === REQUIRED_PROFILE_FIELDS.length, filled, total: REQUIRED_PROFILE_FIELDS.length };
}

export default function MentorDashboard() {
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<{ complete: boolean; filled: number; total: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/pairings").then((r) => r.json()),
      fetch("/api/mentor-profile").then((r) => r.json()),
    ]).then(([pairingsData, profileData]) => {
      setPairings(pairingsData.pairings || []);
      setProfileStatus(profileCompleteness(profileData.profile || null));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const incompleteBanner = profileStatus && !profileStatus.complete ? (
    <Link
      href="/dashboard/mentor-profile"
      className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100 transition group"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center transition">
        <Icon name="alert" size={18} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">Complete your mentor profile before you get paired</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Your profile is {profileStatus.filled}/{profileStatus.total} fields complete. Admins use this to match you with the right mentees — an incomplete profile may delay your pairing.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${(profileStatus.filled / profileStatus.total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
            Fill in now →
          </span>
        </div>
      </div>
    </Link>
  ) : null;

  if (pairings.length === 0) {
    return (
      <div className="space-y-6">
        {incompleteBanner}
        <EmptyState
          icon="graduation"
          title="No mentees assigned yet"
          description="The admin will pair you with mentees soon."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {incompleteBanner}
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
