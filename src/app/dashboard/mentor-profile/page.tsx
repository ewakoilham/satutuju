"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/Icon";

// ── Question definitions ──────────────────────────────────────
type QType =
  | "text"
  | "select"
  | "select-other"
  | "multiselect"

interface Question {
  id: string;
  field: string;
  otherField?: string;
  question: string;
  subtitle?: string;
  type: QType;
  options?: string[];
  optionValues?: string[];
  maxSelect?: number;
  section: string;
}

const QUESTIONS: Question[] = [
  // ── Study Experience ──────────────────────────────────────────
  {
    id: "m1", field: "fullName", section: "Study Experience",
    question: "What is your full name?",
    subtitle: "As it appears on your ID",
    type: "text",
  },
  {
    id: "m2", field: "city", section: "Study Experience",
    question: "What city do you live in?",
    subtitle: "Your current city or district",
    type: "text",
  },
  {
    id: "m3", field: "undergradMajor", section: "Study Experience",
    question: "What was your undergraduate major and degree?",
    subtitle: "e.g. Chemical Engineering, Bachelor's",
    type: "text",
  },
  {
    id: "m4", field: "undergradUniversity", section: "Study Experience",
    question: "Where did you complete your undergraduate degree?",
    subtitle: "University name and country — e.g. Universitas Indonesia, Indonesia",
    type: "text",
  },
  {
    id: "m5", field: "postgradMajor", section: "Study Experience",
    question: "What was your postgraduate major and degree?",
    subtitle: "e.g. Master's in Public Policy",
    type: "text",
  },
  {
    id: "m6", field: "postgradUniversity", section: "Study Experience",
    question: "Where did you complete your postgraduate degree?",
    subtitle: "University name and country — e.g. University of Melbourne, Australia",
    type: "text",
  },
  {
    id: "m7", field: "fundingScheme", otherField: "fundingOther", section: "Study Experience",
    question: "How was your postgraduate study funded?",
    type: "select-other",
    options: ["LPDP Scholarship", "Self-funded", "Other"],
    optionValues: ["lpdp", "self-funded", "other"],
  },
  {
    id: "m8", field: "currentField", otherField: "currentFieldOther", section: "Study Experience",
    question: "What field do you currently work in?",
    type: "select-other",
    options: [
      "Technology & Engineering",
      "Business & Management",
      "Finance & Banking",
      "Consulting",
      "Health & Medicine",
      "Education & Research",
      "Government & Public Policy",
      "Other",
    ],
    optionValues: [
      "technology", "business", "finance", "consulting",
      "health", "education", "government", "other",
    ],
  },

  // ── Mentoring Preference ──────────────────────────────────────
  {
    id: "m9", field: "weeklyHours", section: "Mentoring Preference",
    question: "How many hours per week can you allocate for mentoring?",
    type: "select",
    options: ["1 hour", "2–3 hours", "4–5 hours", "6 hours or more"],
  },
  {
    id: "m10", field: "availability", otherField: "availabilityOther", section: "Mentoring Preference",
    question: "When are you usually available?",
    subtitle: "Select all that apply",
    type: "multiselect",
    options: [
      "Weekday morning (before 9am)",
      "Weekday midday (9am–12pm)",
      "Weekday afternoon (1pm–5pm)",
      "Weekday evening (after 6pm)",
      "Weekend",
    ],
  },
  {
    id: "m11", field: "personality", section: "Mentoring Preference",
    question: "How would you describe yourself?",
    type: "select",
    options: [
      "Introvert — prefer calm, 1-on-1 interactions",
      "Extrovert — open, energetic, love interacting",
      "Ambivert",
    ],
    optionValues: ["introvert", "extrovert", "ambivert"],
  },
  {
    id: "m12", field: "mentorStyle", section: "Mentoring Preference",
    question: "What's your mentoring style?",
    type: "select",
    options: ["Gentle", "Somewhat gentle", "No preference", "Somewhat direct", "Direct"],
    optionValues: ["gentle", "somewhat-gentle", "no-preference", "somewhat-direct", "direct"],
  },
  {
    id: "m13", field: "workStyle", section: "Mentoring Preference",
    question: "What's your working style in sessions?",
    type: "select",
    options: ["Structured", "Somewhat structured", "No preference", "Somewhat flexible", "Flexible"],
    optionValues: ["structured", "somewhat-structured", "no-preference", "somewhat-flexible", "flexible"],
  },
  {
    id: "m14", field: "communicationStyle", section: "Mentoring Preference",
    question: "What's your preferred communication style?",
    type: "select",
    options: ["Formal", "Somewhat formal", "No preference", "Somewhat casual", "Casual"],
    optionValues: ["formal", "somewhat-formal", "no-preference", "somewhat-casual", "casual"],
  },
  {
    id: "m15", field: "primaryRoles", section: "Mentoring Preference",
    question: "What role do you play most in mentoring?",
    subtitle: "Choose up to 2",
    type: "multiselect",
    maxSelect: 2,
    options: [
      "Listener — give the mentee space to reflect",
      "Problem solver — help find concrete solutions",
      "Challenger — push the mentee out of their comfort zone",
      "Motivator — keep their energy and confidence up",
      "Advisor — share personal experience and perspective",
    ],
    optionValues: ["listener", "problem-solver", "challenger", "motivator", "advisor"],
  },
];

// ── Human-readable labels for summary view ──────────────────
const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  city: "City",
  undergradMajor: "Undergrad Major & Degree",
  undergradUniversity: "Undergrad University",
  postgradMajor: "Postgrad Major & Degree",
  postgradUniversity: "Postgrad University",
  fundingScheme: "Funding Scheme",
  fundingOther: "Funding (other)",
  currentField: "Current Field",
  currentFieldOther: "Current Field (other)",
  weeklyHours: "Weekly Hours",
  availability: "Availability",
  availabilityOther: "Availability (other)",
  personality: "Personality",
  mentorStyle: "Mentoring Style",
  workStyle: "Working Style",
  communicationStyle: "Communication Style",
  primaryRoles: "Primary Roles",
};

interface ProfileData {
  [key: string]: string;
}

const buildEmpty = (): ProfileData => {
  const p: ProfileData = {};
  QUESTIONS.forEach((q) => {
    p[q.field] = "";
    if (q.otherField) p[q.otherField] = "";
  });
  return p;
};

function formatValue(field: string, value: string): string {
  if (!value) return "—";
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) return arr.join(", ") || "—";
  } catch { /* not JSON */ }
  return value;
}

export default function MentorProfilePage() {
  const [mode, setMode] = useState<"edit" | "view">("edit");
  const [current, setCurrent] = useState(0);
  const [profile, setProfile] = useState<ProfileData>(buildEmpty);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const total = QUESTIONS.length;
  const q = QUESTIONS[current];
  const progress = ((current + 1) / total) * 100;
  const isLast = current === total - 1;

  // Load existing profile on mount — if data exists, go straight to dashboard view
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/mentor-profile");
        if (res.ok) {
          const data = await res.json();
          if (data && data.fullName) {
            setProfile((prev) => {
              const next = { ...prev };
              Object.keys(data).forEach((k) => {
                if (k in next && data[k] != null) {
                  if (Array.isArray(data[k])) {
                    next[k] = JSON.stringify(data[k]);
                  } else {
                    next[k] = String(data[k]);
                  }
                }
              });
              return next;
            });
            setMode("view");
          }
        }
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (mode === "edit") {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [current, mode]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= total || animating) return;
    setDirection(idx > current ? "next" : "prev");
    setAnimating(true);
    setTimeout(() => { setCurrent(idx); setAnimating(false); }, 200);
  }, [current, total, animating]);

  const handleNext = useCallback(() => { if (!isLast) goTo(current + 1); }, [isLast, goTo, current]);
  const handleBack = useCallback(() => { if (current > 0) goTo(current - 1); }, [current, goTo]);

  const handleSave = async (andFinish = false) => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/mentor-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        setSaving(false);
        return;
      }
      if (andFinish) {
        setMode("view");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && q?.type === "text") {
      e.preventDefault();
      if (isLast) handleSave(true);
      else handleNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, handleNext, q?.type]);

  useEffect(() => {
    if (mode !== "edit") return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, mode]);

  const sections = [...new Set(QUESTIONS.map((q) => q.section))];

  const toggleMultiselect = (value: string) => {
    const currentVal = profile[q.field] ? JSON.parse(profile[q.field] || "[]") : [];
    let next: string[];
    if (currentVal.includes(value)) {
      next = currentVal.filter((v: string) => v !== value);
    } else {
      if (q.maxSelect && currentVal.length >= q.maxSelect) {
        next = [...currentVal.slice(1), value];
      } else {
        next = [...currentVal, value];
      }
    }
    setProfile((p) => ({ ...p, [q.field]: JSON.stringify(next) }));
  };

  const getMultiselectValues = (): string[] => {
    try { return JSON.parse(profile[q.field] || "[]"); } catch { return []; }
  };

  // ── Loading ───────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading your profile…</p>
        </div>
      </div>
    );
  }

  // ── Summary / View Mode ───────────────────────────────────────
  const renderSummary = () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-12">
      {/* Top bar */}
      <div className="px-4 sm:px-8 pt-6 pb-4 sticky top-0 bg-gradient-to-b from-slate-50 to-transparent z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-900">My Profile</h1>
          <button
            onClick={() => setMode("edit")}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Icon name="edit" size={14} />
            Edit Profile
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {sections.map((section) => {
            const sectionQs = QUESTIONS.filter((q) => q.section === section);
            return (
              <div key={section} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-700">{section}</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {sectionQs.map((sq) => {
                    // skip otherField rows — they're shown inline with their parent
                    if (QUESTIONS.some((x) => x.otherField === sq.field)) return null;
                    const val = profile[sq.field];
                    const display = formatValue(sq.field, val);
                    const otherVal = sq.otherField ? profile[sq.otherField] : "";
                    const showOther = sq.otherField && val === "other" && otherVal;
                    return (
                      <div key={sq.field} className="px-6 py-3 flex items-start gap-4">
                        <p className="text-xs text-gray-400 w-40 flex-shrink-0 pt-0.5">
                          {FIELD_LABELS[sq.field] || sq.field}
                        </p>
                        <p className="text-sm text-gray-800 font-medium flex-1">
                          {showOther ? otherVal : display}
                        </p>
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
  );

  if (mode === "view") return renderSummary();

  // ── Edit Mode (step-by-step) ──────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Top bar */}
      <div className="px-4 sm:px-8 pt-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-900">My Profile</h1>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1 animate-fade-in">
                <Icon name="check" size={13} />
                Saved!
              </span>
            )}
            <button
              onClick={() => setMode("view")}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded hover:bg-gray-100"
            >
              <Icon name="eye" size={13} />
              View summary
            </button>
            <span className="text-xs text-gray-400">{current + 1} / {total}</span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 flex gap-2 flex-wrap">
          {sections.map((s) => (
            <span
              key={s}
              className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                s === q.section
                  ? "bg-[var(--primary)] text-white font-medium"
                  : "bg-white text-gray-400 border border-gray-200"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div
            className={`transition-all duration-200 ease-out ${
              animating
                ? direction === "next"
                  ? "opacity-0 translate-x-8"
                  : "opacity-0 -translate-x-8"
                : "opacity-100 translate-x-0"
            }`}
          >
            <p className="text-xs text-[var(--primary)] font-semibold mb-2 tracking-wide">
              QUESTION {current + 1}
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-1">
              {q.question}
            </h2>
            {q.subtitle ? (
              <p className="text-sm text-gray-400 mb-6">{q.subtitle}</p>
            ) : (
              <div className="mb-6" />
            )}

            {/* ── text ── */}
            {q.type === "text" && (
              <input
                ref={inputRef}
                type="text"
                value={profile[q.field] || ""}
                onChange={(e) => setProfile((p) => ({ ...p, [q.field]: e.target.value }))}
                className="w-full text-xl sm:text-2xl bg-transparent border-0 border-b-2 border-gray-300 focus:border-[var(--primary)] outline-none py-3 text-gray-900 placeholder-gray-300 transition-colors"
                placeholder="Type your answer..."
              />
            )}

            {/* ── select ── */}
            {q.type === "select" && (
              <div className="space-y-3">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium ${
                        profile[q.field] === val
                          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── select-other ── */}
            {q.type === "select-other" && (
              <div className="space-y-3">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt.toLowerCase();
                  const isOther = val === "other";
                  return (
                    <div key={opt}>
                      <button
                        onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium ${
                          profile[q.field] === val
                            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {opt}
                      </button>
                      {isOther && profile[q.field] === "other" && q.otherField && (
                        <input
                          type="text"
                          value={profile[q.otherField] || ""}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, [q.otherField!]: e.target.value }))
                          }
                          placeholder="Please specify..."
                          className="mt-2 w-full px-4 py-3 border-2 border-[var(--primary)] rounded-xl outline-none text-base"
                          autoFocus
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── multiselect ── */}
            {q.type === "multiselect" && (
              <div className="space-y-3">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt;
                  const selected = getMultiselectValues().includes(val);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleMultiselect(val)}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium flex items-center gap-3 ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-gray-300"
                        }`}
                      >
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </span>
                      {opt}
                    </button>
                  );
                })}
                {q.id === "m10" && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={profile["availabilityOther"] || ""}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, availabilityOther: e.target.value }))
                      }
                      placeholder="Other availability (optional)..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl outline-none text-base focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                )}
                {q.maxSelect && (
                  <p className="text-xs text-gray-400 mt-1">
                    {getMultiselectValues().length}/{q.maxSelect} selected
                  </p>
                )}
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={handleBack}
              disabled={current === 0}
              className="px-5 py-2.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 transition rounded-lg hover:bg-gray-100"
            >
              ← Back
            </button>
            {isLast ? (
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-8 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50 text-sm"
              >
                {saving ? "Saving..." : "Save Changes →"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition rounded-lg hover:bg-gray-100 border border-gray-200"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition text-sm"
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
