"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

// ── Option lookup maps ────────────────────────────────────────
const FUNDING_LABELS: Record<string, string> = { lpdp: "LPDP Scholarship", "self-funded": "Self-funded", other: "Other" };
const FIELD_LABELS: Record<string, string> = {
  technology: "Technology & Engineering", business: "Business & Management",
  finance: "Finance & Banking", consulting: "Consulting",
  health: "Health & Medicine", education: "Education & Research",
  government: "Government & Public Policy", other: "Other",
};
const MENTOR_STYLE_LABELS: Record<string, string> = {
  gentle: "Gentle", "somewhat-gentle": "Somewhat gentle", "no-preference": "No preference",
  "somewhat-direct": "Somewhat direct", direct: "Direct",
};
const WORK_STYLE_LABELS: Record<string, string> = {
  structured: "Structured", "somewhat-structured": "Somewhat structured", "no-preference": "No preference",
  "somewhat-flexible": "Somewhat flexible", flexible: "Flexible",
};
const COMM_STYLE_LABELS: Record<string, string> = {
  formal: "Formal", "somewhat-formal": "Somewhat formal", "no-preference": "No preference",
  "somewhat-casual": "Somewhat casual", casual: "Casual",
};
const ROLE_LABELS: Record<string, string> = {
  listener: "Listener — give the mentee space to reflect",
  "problem-solver": "Problem solver — help find concrete solutions",
  challenger: "Challenger — push the mentee out of their comfort zone",
  motivator: "Motivator — keep their energy and confidence up",
  advisor: "Advisor — share personal experience and perspective",
};

function label(map: Record<string, string>, val: string) {
  return map[val] || val || "—";
}
function arrLabel(map: Record<string, string>, vals: unknown) {
  const arr = Array.isArray(vals) ? vals : [];
  return arr.length > 0 ? arr.map((v) => map[String(v)] || v).join(", ") : "—";
}

// ── Display components ────────────────────────────────────────
function MissingBadge() {
  return <Badge variant="danger">Missing details</Badge>;
}
function FieldDisplay({ label: lbl, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-text-muted font-medium">{lbl}</p>
      {value && value !== "—" ? <p className="text-sm text-foreground">{value}</p> : <MissingBadge />}
    </div>
  );
}
function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <Icon name={icon} size={18} className="text-primary-600" />
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function MentorProfileAdminView() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [mentorUser, setMentorUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/mentor-profile/${userId}`);
      if (!res.ok) { router.push("/dashboard"); return; }
      const json = await res.json();
      setProfile(json.profile);
      setMentorUser(json.user);
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") { router.push("/dashboard"); return; }
    fetchProfile();
  }, [currentUser, fetchProfile, router]);

  if (loading) return <div className="max-w-3xl mx-auto"><SkeletonDashboard /></div>;

  const p = profile || {};
  const str = (f: string) => String(p[f] ?? "");
  const fundingDisplay = str("fundingScheme") === "other"
    ? str("fundingOther") || "Other"
    : label(FUNDING_LABELS, str("fundingScheme"));
  const fieldDisplay = str("currentField") === "other"
    ? str("currentFieldOther") || "Other"
    : label(FIELD_LABELS, str("currentField"));

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-text-muted-2 hover:text-foreground inline-flex items-center gap-1"
      >
        <Icon name="arrow-left" size={14} />
        Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar name={mentorUser?.name || "Mentor"} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
            {mentorUser?.name || "Mentor Profile"}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">{mentorUser?.email}</p>
        </div>
        {!profile && (
          <Badge variant="warning">Profile not filled</Badge>
        )}
      </div>

      {!profile ? (
        <div className="card text-center py-12 text-text-muted-2">
          <Icon name="user" size={32} className="mx-auto mb-3 text-text-muted-2" />
          <p className="text-sm font-medium">This mentor has not filled in their profile yet.</p>
        </div>
      ) : (
        <>
          {/* Biodata */}
          <SectionCard icon="user" title="Biodata">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDisplay label="Full Name" value={str("fullName")} />
              <FieldDisplay label="City" value={str("city")} />
            </div>
          </SectionCard>

          {/* Education */}
          <SectionCard icon="graduation" title="Education">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDisplay label="Undergraduate Major & Degree" value={str("undergradMajor")} />
              <FieldDisplay label="Undergraduate University" value={str("undergradUniversity")} />
              <FieldDisplay label="Postgraduate Major & Degree" value={str("postgradMajor")} />
              <FieldDisplay label="Postgraduate University" value={str("postgradUniversity")} />
              <FieldDisplay label="Funding Scheme" value={fundingDisplay} />
              <FieldDisplay label="Current Field" value={fieldDisplay} />
            </div>
          </SectionCard>

          {/* Preferences */}
          <SectionCard icon="settings" title="Mentoring Preferences">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldDisplay label="Mentoring Style" value={label(MENTOR_STYLE_LABELS, str("mentorStyle"))} />
              <FieldDisplay label="Working Style" value={label(WORK_STYLE_LABELS, str("workStyle"))} />
              <FieldDisplay label="Communication Style" value={label(COMM_STYLE_LABELS, str("communicationStyle"))} />
              <FieldDisplay label="Primary Mentoring Approach" value={arrLabel(ROLE_LABELS, p.primaryRoles)} />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
