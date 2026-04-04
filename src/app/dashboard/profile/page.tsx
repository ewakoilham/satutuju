"use client";

import { useEffect, useState, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { SkeletonDashboard } from "@/components/ui/Skeleton";

interface ProfileData {
  // Personal
  fullLegalName: string;
  dateOfBirth: string;
  studentId: string;
  phoneNumber: string;
  // National ID
  idNumber: string;
  currentAddress: string;
  legalAddress: string;
  nationality: string;
  passportNumber: string;
  // Academic
  mostRecentSchool: string;
  levelOfStudy: string;
  curriculum: string;
  gpa: string;
  // Goals
  intendedStudyProgram: string;
  intendedMajor: string;
  preferredDestinations: string;
  preferredIntakeMonth: string;
  preferredIntakeYear: string;
  preferredEarliestIntake: string;
  postGraduationPlan: string;
  // Test Prep
  englishTestStatus: string;
  englishTestType: string;
  englishTestDate: string;
  englishTestScore: string;
  // Visa
  hasAppliedVisa: boolean;
  familyAppliedVisa: boolean;
  hasRelativesInStudyCountry: boolean;
  hasPermanentResidency: boolean;
  // Funding
  fundingSource: string;
  studyBudget: string;
}

const EMPTY_PROFILE: ProfileData = {
  fullLegalName: "",
  dateOfBirth: "",
  studentId: "",
  phoneNumber: "",
  idNumber: "",
  currentAddress: "",
  legalAddress: "",
  nationality: "",
  passportNumber: "",
  mostRecentSchool: "",
  levelOfStudy: "",
  curriculum: "",
  gpa: "",
  intendedStudyProgram: "",
  intendedMajor: "",
  preferredDestinations: "",
  preferredIntakeMonth: "",
  preferredIntakeYear: "",
  preferredEarliestIntake: "",
  postGraduationPlan: "",
  englishTestStatus: "",
  englishTestType: "",
  englishTestDate: "",
  englishTestScore: "",
  hasAppliedVisa: false,
  familyAppliedVisa: false,
  hasRelativesInStudyCountry: false,
  hasPermanentResidency: false,
  fundingSource: "",
  studyBudget: "",
};

const LEVEL_OPTIONS = ["High School", "Diploma", "Bachelor's", "Master's", "PhD"];
const TEST_TYPE_OPTIONS = ["IELTS", "TOEFL iBT", "TOEFL ITP", "Duolingo", "PTE", "Cambridge", "Other"];
const TEST_STATUS_OPTIONS = ["Not started", "Preparing", "Scheduled", "Completed"];
const BUDGET_OPTIONS = [
  "Government/Scholarship",
  "Institution covers",
  "10-20K USD",
  "20-30K USD",
  "30-40K USD",
  ">40K USD",
];
const INTAKE_MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const INTAKE_YEAR_OPTIONS = ["2025", "2026", "2027", "2028", "2029"];

type SectionKey =
  | "personal"
  | "nationalId"
  | "academic"
  | "goals"
  | "testPrep"
  | "visa"
  | "funding";

function MissingBadge() {
  return (
    <Badge variant="danger">Missing details</Badge>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string | boolean | undefined | null }) {
  const display =
    typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : value;
  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      {display ? (
        <p className="text-sm text-gray-900">{String(display)}</p>
      ) : (
        <MissingBadge />
      )}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-[var(--primary)]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-500 font-medium">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="input-field resize-none"
      />
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(EMPTY_PROFILE);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.profile) {
        const merged = { ...EMPTY_PROFILE, ...data.profile };
        setProfile(merged);
        setDraft(merged);
      }
      if (data.email) setEmail(data.email);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEdit = (section: SectionKey) => {
    setDraft({ ...profile });
    setEditingSection(section);
  };

  const cancelEdit = () => {
    setDraft({ ...profile });
    setEditingSection(null);
  };

  const saveSection = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (data.profile) {
        const merged = { ...EMPTY_PROFILE, ...data.profile };
        setProfile(merged);
        setDraft(merged);
      }
      setEditingSection(null);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (field: keyof ProfileData, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <SkeletonDashboard />
      </div>
    );
  }

  const isEditing = (section: SectionKey) => editingSection === section;

  const sectionHeader = (
    iconName: string,
    title: string,
    section: SectionKey
  ) => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        <Icon name={iconName} size={18} className="text-primary-600" /> {title}
      </h2>
      {isEditing(section) ? (
        <div className="flex items-center gap-2">
          <button
            onClick={cancelEdit}
            className="btn-ghost text-sm px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={saveSection}
            disabled={saving}
            className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => startEdit(section)}
          className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
        >
          <Icon name="edit" size={14} />
          Edit
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Avatar name={profile.fullLegalName || email || "User"} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-heading)]">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete your profile to help your mentor guide you better.
          </p>
        </div>
      </div>

      {/* Personal Information */}
      <div className={`card ${isEditing("personal") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("user", "Personal Information", "personal")}
        {isEditing("personal") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Full Legal Name"
              value={draft.fullLegalName}
              onChange={(v) => updateDraft("fullLegalName", v)}
            />
            <TextInput
              label="Date of Birth"
              value={draft.dateOfBirth}
              onChange={(v) => updateDraft("dateOfBirth", v)}
              type="date"
            />
            <TextInput
              label="Student ID"
              value={draft.studentId}
              onChange={(v) => updateDraft("studentId", v)}
            />
            <TextInput
              label="Phone Number"
              value={draft.phoneNumber}
              onChange={(v) => updateDraft("phoneNumber", v)}
              type="tel"
            />
            <div className="space-y-1">
              <label className="block text-xs text-gray-500 font-medium">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Full Legal Name" value={profile.fullLegalName} />
            <FieldDisplay label="Date of Birth" value={profile.dateOfBirth} />
            <FieldDisplay label="Student ID" value={profile.studentId} />
            <FieldDisplay label="Phone Number" value={profile.phoneNumber} />
            <FieldDisplay label="Email" value={email} />
          </div>
        )}
      </div>

      {/* National ID */}
      <div className={`card ${isEditing("nationalId") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("lock", "National ID", "nationalId")}
        {isEditing("nationalId") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="ID Number"
              value={draft.idNumber}
              onChange={(v) => updateDraft("idNumber", v)}
            />
            <TextInput
              label="Nationality"
              value={draft.nationality}
              onChange={(v) => updateDraft("nationality", v)}
            />
            <TextInput
              label="Passport Number"
              value={draft.passportNumber}
              onChange={(v) => updateDraft("passportNumber", v)}
            />
            <div className="sm:col-span-2">
              <TextareaInput
                label="Current Address"
                value={draft.currentAddress}
                onChange={(v) => updateDraft("currentAddress", v)}
              />
            </div>
            <div className="sm:col-span-2">
              <TextareaInput
                label="Legal Address"
                value={draft.legalAddress}
                onChange={(v) => updateDraft("legalAddress", v)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="ID Number" value={profile.idNumber} />
            <FieldDisplay label="Nationality" value={profile.nationality} />
            <FieldDisplay label="Passport Number" value={profile.passportNumber} />
            <FieldDisplay label="Current Address" value={profile.currentAddress} />
            <FieldDisplay label="Legal Address" value={profile.legalAddress} />
          </div>
        )}
      </div>

      {/* Academic Background */}
      <div className={`card ${isEditing("academic") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("graduation", "Academic Background", "academic")}
        {isEditing("academic") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Most Recent School"
              value={draft.mostRecentSchool}
              onChange={(v) => updateDraft("mostRecentSchool", v)}
            />
            <SelectInput
              label="Level of Study"
              value={draft.levelOfStudy}
              onChange={(v) => updateDraft("levelOfStudy", v)}
              options={LEVEL_OPTIONS}
            />
            <TextInput
              label="Curriculum"
              value={draft.curriculum}
              onChange={(v) => updateDraft("curriculum", v)}
              placeholder="e.g. IB, A-Levels, National"
            />
            <TextInput
              label="GPA"
              value={draft.gpa}
              onChange={(v) => updateDraft("gpa", v)}
              placeholder="e.g. 3.8/4.0"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Most Recent School" value={profile.mostRecentSchool} />
            <FieldDisplay label="Level of Study" value={profile.levelOfStudy} />
            <FieldDisplay label="Curriculum" value={profile.curriculum} />
            <FieldDisplay label="GPA" value={profile.gpa} />
          </div>
        )}
      </div>

      {/* Goals and Preferences */}
      <div className={`card ${isEditing("goals") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("map", "Goals and Preferences", "goals")}
        {isEditing("goals") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Intended Study Program"
              value={draft.intendedStudyProgram}
              onChange={(v) => updateDraft("intendedStudyProgram", v)}
              placeholder="e.g. Bachelor's in Computer Science"
            />
            <TextInput
              label="Intended Major / Field"
              value={draft.intendedMajor}
              onChange={(v) => updateDraft("intendedMajor", v)}
            />
            <TextInput
              label="Preferred Study Destinations"
              value={draft.preferredDestinations}
              onChange={(v) => updateDraft("preferredDestinations", v)}
              placeholder="e.g. UK, Australia, Canada"
            />
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 font-medium mb-1">Preferred Earliest Intake</label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={draft.preferredIntakeMonth || ""}
                  onChange={(e) => {
                    updateDraft("preferredIntakeMonth", e.target.value);
                    updateDraft("preferredEarliestIntake", `${e.target.value} ${draft.preferredIntakeYear || ""}`.trim());
                  }}
                  className="input-field"
                >
                  <option value="">Month</option>
                  {INTAKE_MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={draft.preferredIntakeYear || ""}
                  onChange={(e) => {
                    updateDraft("preferredIntakeYear", e.target.value);
                    updateDraft("preferredEarliestIntake", `${draft.preferredIntakeMonth || ""} ${e.target.value}`.trim());
                  }}
                  className="input-field"
                >
                  <option value="">Year</option>
                  {INTAKE_YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <TextareaInput
                label="Post-Graduation Plan"
                value={draft.postGraduationPlan}
                onChange={(v) => updateDraft("postGraduationPlan", v)}
                placeholder="What do you plan to do after graduation?"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Intended Study Program" value={profile.intendedStudyProgram} />
            <FieldDisplay label="Intended Major / Field" value={profile.intendedMajor} />
            <FieldDisplay label="Preferred Study Destinations" value={profile.preferredDestinations} />
            <FieldDisplay label="Preferred Earliest Intake" value={profile.preferredEarliestIntake} />
            <FieldDisplay label="Post-Graduation Plan" value={profile.postGraduationPlan} />
          </div>
        )}
      </div>

      {/* Test Preparation */}
      <div className={`card ${isEditing("testPrep") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("clipboard-check", "Test Preparation Interest", "testPrep")}
        {isEditing("testPrep") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectInput
              label="English Language Test Status"
              value={draft.englishTestStatus}
              onChange={(v) => updateDraft("englishTestStatus", v)}
              options={TEST_STATUS_OPTIONS}
            />
            <SelectInput
              label="Test Type"
              value={draft.englishTestType}
              onChange={(v) => updateDraft("englishTestType", v)}
              options={TEST_TYPE_OPTIONS}
            />
            <TextInput
              label="Test Date"
              value={draft.englishTestDate}
              onChange={(v) => updateDraft("englishTestDate", v)}
              type="date"
            />
            <TextInput
              label="Test Score"
              value={draft.englishTestScore}
              onChange={(v) => updateDraft("englishTestScore", v)}
              placeholder="e.g. 7.5 (IELTS), 100 (TOEFL)"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="English Language Test Status" value={profile.englishTestStatus} />
            <FieldDisplay label="Test Type" value={profile.englishTestType} />
            <FieldDisplay label="Test Date" value={profile.englishTestDate} />
            <FieldDisplay label="Test Score" value={profile.englishTestScore} />
          </div>
        )}
      </div>

      {/* Visa Status */}
      <div className={`card ${isEditing("visa") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("globe", "Visa Status", "visa")}
        {isEditing("visa") ? (
          <div className="space-y-3">
            <ToggleInput
              label="Have you ever applied for a visa?"
              value={draft.hasAppliedVisa}
              onChange={(v) => updateDraft("hasAppliedVisa", v)}
            />
            <ToggleInput
              label="Has anyone in your family applied for a visa?"
              value={draft.familyAppliedVisa}
              onChange={(v) => updateDraft("familyAppliedVisa", v)}
            />
            <ToggleInput
              label="Do you have relatives in the study country?"
              value={draft.hasRelativesInStudyCountry}
              onChange={(v) => updateDraft("hasRelativesInStudyCountry", v)}
            />
            <ToggleInput
              label="Do you have permanent residency abroad?"
              value={draft.hasPermanentResidency}
              onChange={(v) => updateDraft("hasPermanentResidency", v)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Applied for Visa" value={profile.hasAppliedVisa} />
            <FieldDisplay label="Family Applied for Visa" value={profile.familyAppliedVisa} />
            <FieldDisplay label="Relatives in Study Country" value={profile.hasRelativesInStudyCountry} />
            <FieldDisplay label="Permanent Residency Abroad" value={profile.hasPermanentResidency} />
          </div>
        )}
      </div>

      {/* Funding */}
      <div className={`card ${isEditing("funding") ? "bg-primary-50/50" : ""}`}>
        {sectionHeader("chart", "Funding", "funding")}
        {isEditing("funding") ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput
              label="Who Funds Your Study?"
              value={draft.fundingSource}
              onChange={(v) => updateDraft("fundingSource", v)}
              placeholder="e.g. Parents, Self, LPDP Scholarship"
            />
            <SelectInput
              label="Study Budget"
              value={draft.studyBudget}
              onChange={(v) => updateDraft("studyBudget", v)}
              options={BUDGET_OPTIONS}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldDisplay label="Who Funds Your Study?" value={profile.fundingSource} />
            <FieldDisplay label="Study Budget" value={profile.studyBudget} />
          </div>
        )}
      </div>
    </div>
  );
}
