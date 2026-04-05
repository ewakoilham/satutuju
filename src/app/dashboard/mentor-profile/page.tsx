"use client";

import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useUser } from "@/lib/hooks";

// ── Data shape ────────────────────────────────────────────────
interface MentorProfileData {
  fullName: string;
  city: string;
  undergradMajor: string;
  undergradUniversity: string;
  postgradMajor: string;
  postgradUniversity: string;
  fundingScheme: string;
  fundingOther: string;
  currentField: string;
  currentFieldOther: string;
  weeklyHours: string;
  availability: string;
  personality: string;
  mentorStyle: string;
  workStyle: string;
  communicationStyle: string;
  primaryRoles: string;
}

const EMPTY: MentorProfileData = {
  fullName: "", city: "",
  undergradMajor: "", undergradUniversity: "",
  postgradMajor: "", postgradUniversity: "",
  fundingScheme: "", fundingOther: "",
  currentField: "", currentFieldOther: "",
  weeklyHours: "", availability: "",
  personality: "", mentorStyle: "", workStyle: "",
  communicationStyle: "", primaryRoles: "",
};

// ── Option lists ──────────────────────────────────────────────
const FUNDING_OPTIONS = ["LPDP Scholarship", "Self-funded", "Other"];
const FUNDING_VALUES  = ["lpdp", "self-funded", "other"];

const FIELD_OPTIONS = [
  "Technology & Engineering", "Business & Management", "Finance & Banking",
  "Consulting", "Health & Medicine", "Education & Research",
  "Government & Public Policy", "Other",
];
const FIELD_VALUES = [
  "technology", "business", "finance", "consulting",
  "health", "education", "government", "other",
];

const HOURS_OPTIONS = ["1 hour", "2–3 hours", "4–5 hours", "6 hours or more"];

const AVAIL_OPTIONS = [
  "Weekday morning (before 9am)", "Weekday midday (9am–12pm)",
  "Weekday afternoon (1pm–5pm)", "Weekday evening (after 6pm)", "Weekend",
];
const AVAIL_VALUES = ["morning", "midday", "afternoon", "evening", "weekend"];

const PERSONALITY_OPTIONS = [
  "Introvert — prefer calm, 1-on-1 interactions",
  "Extrovert — open, energetic, love interacting",
  "Ambivert",
];
const PERSONALITY_VALUES = ["introvert", "extrovert", "ambivert"];

const MENTOR_STYLE_OPTIONS = ["Gentle", "Somewhat gentle", "No preference", "Somewhat direct", "Direct"];
const MENTOR_STYLE_VALUES  = ["gentle", "somewhat-gentle", "no-preference", "somewhat-direct", "direct"];

const WORK_STYLE_OPTIONS = ["Structured", "Somewhat structured", "No preference", "Somewhat flexible", "Flexible"];
const WORK_STYLE_VALUES  = ["structured", "somewhat-structured", "no-preference", "somewhat-flexible", "flexible"];

const COMM_STYLE_OPTIONS = ["Formal", "Somewhat formal", "No preference", "Somewhat casual", "Casual"];
const COMM_STYLE_VALUES  = ["formal", "somewhat-formal", "no-preference", "somewhat-casual", "casual"];

const ROLE_OPTIONS = [
  "Listener — give the mentee space to reflect",
  "Problem solver — help find concrete solutions",
  "Challenger — push the mentee out of their comfort zone",
  "Motivator — keep their energy and confidence up",
  "Advisor — share personal experience and perspective",
];
const ROLE_VALUES = ["listener", "problem-solver", "challenger", "motivator", "advisor"];

// ── Value → label helper ──────────────────────────────────────
function labelFor(value: string, values: string[], labels: string[]): string {
  const idx = values.indexOf(value);
  return idx >= 0 ? labels[idx] : value;
}

// ── Reusable components ───────────────────────────────────────
function MissingBadge() {
  return <Badge variant="danger">Missing details</Badge>;
}

function FieldDisplay({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      {value ? <p className="text-sm text-gray-900">{value}</p> : <MissingBadge />}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options, values, placeholder = "Select..." }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; values?: string[]; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="input-field">
        <option value="">{placeholder}</option>
        {options.map((opt, i) => (
          <option key={opt} value={values?.[i] ?? opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function SelectOtherInput({ label, value, otherValue, onChange, onOtherChange, options, values }: {
  label: string; value: string; otherValue: string;
  onChange: (v: string) => void; onOtherChange: (v: string) => void;
  options: string[]; values: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="input-field">
        <option value="">Select...</option>
        {options.map((opt, i) => (
          <option key={opt} value={values[i]}>{opt}</option>
        ))}
      </select>
      {value === "other" && (
        <input
          type="text"
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Please specify..."
          className="input-field mt-1"
        />
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────
type SectionKey = "biodata" | "education" | "preferences";

// ── Main page ─────────────────────────────────────────────────
export default function MentorProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<MentorProfileData>(EMPTY);
  const [draft, setDraft]     = useState<MentorProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [saving, setSaving]   = useState(false);

  // Parse API response — availability/primaryRoles come as JSONB arrays; take first element
  const parseProfile = (data: Record<string, unknown>): MentorProfileData => {
    const firstOf = (v: unknown): string => {
      if (Array.isArray(v) && v.length > 0) return String(v[0]);
      if (typeof v === "string" && v.startsWith("[")) {
        try { const arr = JSON.parse(v); return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : ""; }
        catch { return ""; }
      }
      return typeof v === "string" ? v : "";
    };
    return {
      fullName:           String(data.fullName           ?? ""),
      city:               String(data.city               ?? ""),
      undergradMajor:     String(data.undergradMajor     ?? ""),
      undergradUniversity: String(data.undergradUniversity ?? ""),
      postgradMajor:      String(data.postgradMajor      ?? ""),
      postgradUniversity: String(data.postgradUniversity ?? ""),
      fundingScheme:      String(data.fundingScheme      ?? ""),
      fundingOther:       String(data.fundingOther       ?? ""),
      currentField:       String(data.currentField       ?? ""),
      currentFieldOther:  String(data.currentFieldOther  ?? ""),
      weeklyHours:        String(data.weeklyHours        ?? ""),
      availability:       firstOf(data.availability),
      personality:        String(data.personality        ?? ""),
      mentorStyle:        String(data.mentorStyle        ?? ""),
      workStyle:          String(data.workStyle          ?? ""),
      communicationStyle: String(data.communicationStyle ?? ""),
      primaryRoles:       firstOf(data.primaryRoles),
    };
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/mentor-profile");
      if (res.ok) {
        const json = await res.json();
        if (json.profile) {
          const parsed = parseProfile(json.profile);
          setProfile(parsed);
          setDraft(parsed);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const startEdit  = (section: SectionKey) => { setDraft({ ...profile }); setEditingSection(section); };
  const cancelEdit = () => { setDraft({ ...profile }); setEditingSection(null); };

  const saveSection = async () => {
    setSaving(true);
    try {
      // Wrap single-value fields back to arrays for JSONB consistency
      const payload = {
        ...draft,
        availability: draft.availability ? [draft.availability] : [],
        primaryRoles: draft.primaryRoles ? [draft.primaryRoles] : [],
      };
      const res = await fetch("/api/mentor-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setProfile({ ...draft });
        setEditingSection(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const upd = (field: keyof MentorProfileData, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return <div className="max-w-3xl mx-auto"><SkeletonDashboard /></div>;
  }

  const isEditing = (s: SectionKey) => editingSection === s;

  const SectionHeader = ({ icon, title, section }: { icon: string; title: string; section: SectionKey }) => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        <Icon name={icon} size={18} className="text-primary-600" />
        {title}
      </h2>
      {isEditing(section) ? (
        <div className="flex items-center gap-2">
          <button onClick={cancelEdit} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
          <button onClick={saveSection} disabled={saving} className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <button onClick={() => startEdit(section)} className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5">
          <Icon name="edit" size={14} />
          Edit
        </button>
      )}
    </div>
  );

  // Display label lookups
  const fundingDisplay = profile.fundingScheme === "other"
    ? profile.fundingOther || "Other"
    : labelFor(profile.fundingScheme, FUNDING_VALUES, FUNDING_OPTIONS);
  const fieldDisplay = profile.currentField === "other"
    ? profile.currentFieldOther || "Other"
    : labelFor(profile.currentField, FIELD_VALUES, FIELD_OPTIONS);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar name={profile.fullName || user?.name || "Mentor"} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-heading)]">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your mentor profile visible to the admin team and mentees.</p>
        </div>
      </div>

      {/* ── Biodata ─────────────────────────────────────────────── */}
      <div className={`card ${isEditing("biodata") ? "bg-primary-50/50" : ""}`}>
        <SectionHeader icon="user" title="Biodata" section="biodata" />
        {isEditing("biodata") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Full Name" value={draft.fullName} onChange={(v) => upd("fullName", v)} placeholder="As on your ID" />
            <TextInput label="City" value={draft.city} onChange={(v) => upd("city", v)} placeholder="Your current city" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Full Name" value={profile.fullName} />
            <FieldDisplay label="City" value={profile.city} />
          </div>
        )}
      </div>

      {/* ── Education ───────────────────────────────────────────── */}
      <div className={`card ${isEditing("education") ? "bg-primary-50/50" : ""}`}>
        <SectionHeader icon="graduation" title="Education" section="education" />
        {isEditing("education") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="Undergraduate Major & Degree" value={draft.undergradMajor} onChange={(v) => upd("undergradMajor", v)} placeholder="e.g. Chemical Engineering, Bachelor's" />
            <TextInput label="Undergraduate University" value={draft.undergradUniversity} onChange={(v) => upd("undergradUniversity", v)} placeholder="e.g. Universitas Indonesia, Indonesia" />
            <TextInput label="Postgraduate Major & Degree" value={draft.postgradMajor} onChange={(v) => upd("postgradMajor", v)} placeholder="e.g. Master's in Public Policy" />
            <TextInput label="Postgraduate University" value={draft.postgradUniversity} onChange={(v) => upd("postgradUniversity", v)} placeholder="e.g. University of Melbourne, Australia" />
            <SelectOtherInput
              label="Funding Scheme"
              value={draft.fundingScheme} otherValue={draft.fundingOther}
              onChange={(v) => upd("fundingScheme", v)} onOtherChange={(v) => upd("fundingOther", v)}
              options={FUNDING_OPTIONS} values={FUNDING_VALUES}
            />
            <SelectOtherInput
              label="Current Field"
              value={draft.currentField} otherValue={draft.currentFieldOther}
              onChange={(v) => upd("currentField", v)} onOtherChange={(v) => upd("currentFieldOther", v)}
              options={FIELD_OPTIONS} values={FIELD_VALUES}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Undergraduate Major & Degree" value={profile.undergradMajor} />
            <FieldDisplay label="Undergraduate University" value={profile.undergradUniversity} />
            <FieldDisplay label="Postgraduate Major & Degree" value={profile.postgradMajor} />
            <FieldDisplay label="Postgraduate University" value={profile.postgradUniversity} />
            <FieldDisplay label="Funding Scheme" value={fundingDisplay} />
            <FieldDisplay label="Current Field" value={fieldDisplay} />
          </div>
        )}
      </div>

      {/* ── Mentoring Preferences ───────────────────────────────── */}
      <div className={`card ${isEditing("preferences") ? "bg-primary-50/50" : ""}`}>
        <SectionHeader icon="settings" title="Mentoring Preferences" section="preferences" />
        {isEditing("preferences") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput label="Weekly Hours" value={draft.weeklyHours} onChange={(v) => upd("weeklyHours", v)} options={HOURS_OPTIONS} />
            <SelectInput label="Availability" value={draft.availability} onChange={(v) => upd("availability", v)} options={AVAIL_OPTIONS} values={AVAIL_VALUES} />
            <SelectInput label="Personality" value={draft.personality} onChange={(v) => upd("personality", v)} options={PERSONALITY_OPTIONS} values={PERSONALITY_VALUES} />
            <SelectInput label="Mentoring Style" value={draft.mentorStyle} onChange={(v) => upd("mentorStyle", v)} options={MENTOR_STYLE_OPTIONS} values={MENTOR_STYLE_VALUES} />
            <SelectInput label="Working Style" value={draft.workStyle} onChange={(v) => upd("workStyle", v)} options={WORK_STYLE_OPTIONS} values={WORK_STYLE_VALUES} />
            <SelectInput label="Communication Style" value={draft.communicationStyle} onChange={(v) => upd("communicationStyle", v)} options={COMM_STYLE_OPTIONS} values={COMM_STYLE_VALUES} />
            <SelectInput label="Primary Role in Mentoring" value={draft.primaryRoles} onChange={(v) => upd("primaryRoles", v)} options={ROLE_OPTIONS} values={ROLE_VALUES} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Weekly Hours" value={profile.weeklyHours} />
            <FieldDisplay label="Availability" value={labelFor(profile.availability, AVAIL_VALUES, AVAIL_OPTIONS)} />
            <FieldDisplay label="Personality" value={labelFor(profile.personality, PERSONALITY_VALUES, PERSONALITY_OPTIONS)} />
            <FieldDisplay label="Mentoring Style" value={labelFor(profile.mentorStyle, MENTOR_STYLE_VALUES, MENTOR_STYLE_OPTIONS)} />
            <FieldDisplay label="Working Style" value={labelFor(profile.workStyle, WORK_STYLE_VALUES, WORK_STYLE_OPTIONS)} />
            <FieldDisplay label="Communication Style" value={labelFor(profile.communicationStyle, COMM_STYLE_VALUES, COMM_STYLE_OPTIONS)} />
            <FieldDisplay label="Primary Role in Mentoring" value={labelFor(profile.primaryRoles, ROLE_VALUES, ROLE_OPTIONS)} />
          </div>
        )}
      </div>
    </div>
  );
}
