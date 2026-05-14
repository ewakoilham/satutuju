"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Question definitions ──────────────────────────────────────
type QType =
  | "text"
  | "select"
  | "select-other"   // select with free-text "Other" option
  | "multiselect"    // checkboxes, optional maxSelect
  | "scale";         // 5-point named scale

interface Question {
  id: string;
  field: string;
  otherField?: string;   // companion field when "Other" is chosen
  question: string;
  subtitle?: string;
  type: QType;
  options?: string[];
  optionValues?: string[]; // parallel to options (stored value)
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
    question: "What is your primary mentoring approach?",
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

export default function MentorOnboardingPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [current, setCurrent] = useState(0);
  const [profile, setProfile] = useState<ProfileData>(buildEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If the mentor's profile is already complete enough to pass the dashboard
  // gate (middleware checks fullName + mentorStyle), skip onboarding. Otherwise
  // preload whatever values exist so the user can resume from where they left
  // off — and we don't loop back to dashboard only to bounce back here again.
  useEffect(() => {
    fetch("/api/mentor-profile")
      .then((r) => r.json())
      .then((data) => {
        const p = data.profile;
        if (!p) return;
        if (p.fullName && p.mentorStyle) {
          router.replace("/dashboard");
          return;
        }
        setProfile((prev) => {
          const next = { ...prev };
          for (const ques of QUESTIONS) {
            const v = p[ques.field];
            if (typeof v === "string") next[ques.field] = v;
            if (ques.otherField) {
              const ov = p[ques.otherField];
              if (typeof ov === "string") next[ques.otherField] = ov;
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, [router]);

  const total = QUESTIONS.length;
  const q = QUESTIONS[current];
  const progress = ((current + 1) / total) * 100;
  const isLast = current === total - 1;

  // Whether the current question has a valid answer — gates the
  // Continue / Complete buttons so the user can't reach the end with empty
  // required fields (which would otherwise loop them through the dashboard
  // middleware gate).
  const currentAnswered = (() => {
    const v = profile[q.field];
    if (!v || !v.trim()) return false;
    if (q.type === "select-other" && v === "other" && q.otherField) {
      return Boolean(profile[q.otherField]?.trim());
    }
    if (q.type === "multiselect") {
      try {
        const arr = JSON.parse(v || "[]");
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }
    return true;
  })();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [current]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= total || animating) return;
    setDirection(idx > current ? "next" : "prev");
    setAnimating(true);
    setTimeout(() => { setCurrent(idx); setAnimating(false); }, 200);
  }, [current, total, animating]);

  const handleNext = useCallback(() => {
    if (isLast || !currentAnswered) return;
    goTo(current + 1);
  }, [isLast, currentAnswered, goTo, current]);
  const handleBack = useCallback(() => { if (current > 0) goTo(current - 1); }, [current, goTo]);

  const handleComplete = async () => {
    if (!currentAnswered) {
      setError("Please answer this question before completing your profile.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/mentor-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save profile");
        setSaving(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" && q.type === "text") {
      e.preventDefault();
      if (isLast) handleComplete();
      else handleNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLast, handleNext, q?.type]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const sections = [...new Set(QUESTIONS.map((q) => q.section))];

  const toggleMultiselect = (value: string) => {
    const current_val = profile[q.field] ? JSON.parse(profile[q.field] || "[]") : [];
    let next: string[];
    if (current_val.includes(value)) {
      next = current_val.filter((v: string) => v !== value);
    } else {
      if (q.maxSelect && current_val.length >= q.maxSelect) {
        next = [...current_val.slice(1), value];
      } else {
        next = [...current_val, value];
      }
    }
    setProfile((p) => ({ ...p, [q.field]: JSON.stringify(next) }));
  };

  const getMultiselectValues = (): string[] => {
    try { return JSON.parse(profile[q.field] || "[]"); } catch { return []; }
  };

  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <span className="text-sm font-semibold text-[var(--primary)] tracking-wide">SATU TUJU</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Welcome, Mentor!
          </h1>
          <p className="text-text-muted text-base sm:text-lg leading-relaxed">
            Before you start, let&apos;s set up your mentor profile so mentees and the admin team can get to know you better.
          </p>
          <p className="text-sm text-text-muted-2">This will only take a few minutes.</p>
          <button
            onClick={() => setShowIntro(false)}
            className="bg-[var(--primary)] text-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition text-base"
          >
            Let&apos;s Go
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Top bar */}
      <div className="px-4 sm:px-8 pt-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--primary)]">SATU TUJU</span>
          <span className="text-xs text-text-muted-2">{current + 1} / {total}</span>
        </div>
        <div className="max-w-2xl mx-auto mt-3">
          <div className="w-full h-1 bg-surface-elevated rounded-full overflow-hidden">
            <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-3 flex gap-2 flex-wrap">
          {sections.map((s) => (
            <span key={s} className={`text-xs px-2.5 py-1 rounded-full transition-all ${
              s === q.section ? "bg-[var(--primary)] text-white font-medium" : "bg-surface text-text-muted-2 border border-border"
            }`}>{s}</span>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className={`transition-all duration-200 ease-out ${
            animating ? (direction === "next" ? "opacity-0 translate-x-8" : "opacity-0 -translate-x-8") : "opacity-100 translate-x-0"
          }`}>
            <p className="text-xs text-[var(--primary)] font-semibold mb-2 tracking-wide">QUESTION {current + 1}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-1">{q.question}</h2>
            {q.subtitle ? (
              <p className="text-sm text-text-muted-2 mb-6">{q.subtitle}</p>
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
                className="w-full text-xl sm:text-2xl bg-transparent border-0 border-b-2 border-gray-300 focus:border-[var(--primary)] outline-none py-3 text-foreground placeholder-gray-300 transition-colors"
                placeholder="Type your answer..."
              />
            )}

            {/* ── select ── */}
            {q.type === "select" && (
              <div className="space-y-3">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt;
                  return (
                    <button key={opt} onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium ${
                        profile[q.field] === val
                          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                          : "border-border bg-surface text-foreground hover:border-gray-300"
                      }`}>
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
                      <button onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium ${
                          profile[q.field] === val
                            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                            : "border-border bg-surface text-foreground hover:border-gray-300"
                        }`}>
                        {opt}
                      </button>
                      {isOther && profile[q.field] === "other" && q.otherField && (
                        <input
                          type="text"
                          value={profile[q.otherField] || ""}
                          onChange={(e) => setProfile((p) => ({ ...p, [q.otherField!]: e.target.value }))}
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
                    <button key={opt} onClick={() => toggleMultiselect(val)}
                      className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all text-base font-medium flex items-center gap-3 ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                          : "border-border bg-surface text-foreground hover:border-gray-300"
                      }`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? "bg-[var(--primary)] border-[var(--primary)]" : "border-gray-300"
                      }`}>
                        {selected && <span className="text-white text-xs font-bold">✓</span>}
                      </span>
                      {opt}
                    </button>
                  );
                })}
                {q.maxSelect && (
                  <p className="text-xs text-text-muted-2 mt-1">
                    {getMultiselectValues().length}/{q.maxSelect} selected
                  </p>
                )}
              </div>
            )}

            {/* ── scale ── */}
            {q.type === "scale" && (
              <div className="space-y-3">
                <div className="flex gap-2 sm:gap-3">
                  {(q.options || []).map((opt, i) => {
                    const val = q.optionValues?.[i] ?? opt;
                    const selected = profile[q.field] === val;
                    return (
                      <button key={opt} onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                        className={`flex-1 py-3 px-1 rounded-xl border-2 transition-all text-xs sm:text-sm font-medium text-center ${
                          selected
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                            : "border-border bg-surface text-text-muted-3 hover:border-gray-300"
                        }`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {q.options && (
                  <div className="flex justify-between text-[10px] text-text-muted-2 px-1">
                    <span>{q.options[0]}</span>
                    <span>{q.options[q.options.length - 1]}</span>
                  </div>
                )}
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button onClick={handleBack} disabled={current === 0}
              className="px-5 py-2.5 text-sm text-text-muted hover:text-foreground disabled:opacity-30 transition rounded-lg hover:bg-surface-elevated">
              ← Back
            </button>
            {isLast ? (
              <button onClick={handleComplete} disabled={saving || !currentAnswered}
                className="px-8 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                {saving ? "Saving..." : "Complete Profile →"}
              </button>
            ) : (
              <button onClick={handleNext} disabled={!currentAnswered}
                className="px-8 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
