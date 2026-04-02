"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Question definitions ──────────────────────────────────────
interface Question {
  id: string;
  field: string;
  question: string;
  subtitle?: string;
  type: "text" | "date" | "select" | "toggle" | "textarea" | "tel" | "month-year";
  options?: string[];
  placeholder?: string;
  section: string;
}

const QUESTIONS: Question[] = [
  // Personal
  { id: "q1", field: "fullLegalName", question: "What is your full legal name?", subtitle: "As it appears on your passport or ID", type: "text", placeholder: "e.g. Muhammad Ilham Razak", section: "Personal" },
  { id: "q2", field: "dateOfBirth", question: "When were you born?", type: "date", section: "Personal" },
  { id: "q3", field: "phoneNumber", question: "What's your phone number?", subtitle: "Include country code", type: "tel", placeholder: "e.g. +62 812 3456 7890", section: "Personal" },
  { id: "q4", field: "studentId", question: "What's your student ID?", subtitle: "Skip if you don't have one", type: "text", placeholder: "e.g. 2024010001", section: "Personal" },
  // National ID
  { id: "q5", field: "nationality", question: "What is your nationality?", type: "text", placeholder: "e.g. Indonesian", section: "Identity" },
  { id: "q6", field: "idNumber", question: "What is your national ID number?", subtitle: "NIK / KTP number", type: "text", placeholder: "e.g. 3171012345678901", section: "Identity" },
  { id: "q7", field: "passportNumber", question: "What is your passport number?", subtitle: "Skip if you don't have one yet", type: "text", placeholder: "e.g. A1234567", section: "Identity" },
  { id: "q8", field: "currentAddress", question: "Where do you currently live?", type: "textarea", placeholder: "Your current address...", section: "Identity" },
  { id: "q9", field: "legalAddress", question: "What is your legal / permanent address?", subtitle: "As stated on your ID card", type: "textarea", placeholder: "Your legal address...", section: "Identity" },
  // Academic
  { id: "q10", field: "mostRecentSchool", question: "What school did you most recently attend?", type: "text", placeholder: "e.g. Universitas Indonesia", section: "Academic" },
  { id: "q11", field: "levelOfStudy", question: "What level of study have you completed?", type: "select", options: ["High School", "Diploma", "Bachelor's", "Master's", "PhD"], section: "Academic" },
  { id: "q12", field: "curriculum", question: "What curriculum did you follow?", type: "text", placeholder: "e.g. IB, A-Levels, National, Cambridge", section: "Academic" },
  { id: "q13", field: "gpa", question: "What was your GPA?", type: "text", placeholder: "e.g. 3.8 / 4.0", section: "Academic" },
  // Goals
  { id: "q14", field: "intendedStudyProgram", question: "What program do you want to study?", subtitle: "The degree you're aiming for", type: "text", placeholder: "e.g. Master's in Data Science", section: "Goals" },
  { id: "q15", field: "intendedMajor", question: "What major or field interests you?", type: "text", placeholder: "e.g. Computer Science, Business, Medicine", section: "Goals" },
  { id: "q16", field: "preferredDestinations", question: "Where would you like to study?", subtitle: "List your preferred countries", type: "text", placeholder: "e.g. UK, Australia, Canada", section: "Goals" },
  { id: "q17", field: "preferredEarliestIntake", question: "When do you want to start?", subtitle: "Pick your preferred month and year", type: "month-year", section: "Goals" },
  { id: "q18", field: "postGraduationPlan", question: "What's your plan after graduation?", type: "textarea", placeholder: "e.g. Work in tech industry abroad, return home to start a business...", section: "Goals" },
  // Test
  { id: "q19", field: "englishTestStatus", question: "Have you taken an English language test?", type: "select", options: ["Not started", "Preparing", "Scheduled", "Completed"], section: "Test Prep" },
  { id: "q20", field: "englishTestType", question: "Which English test?", type: "select", options: ["IELTS", "TOEFL iBT", "TOEFL ITP", "Duolingo", "PTE", "Cambridge", "Other"], section: "Test Prep" },
  { id: "q21", field: "englishTestDate", question: "When is/was your test date?", type: "date", section: "Test Prep" },
  { id: "q22", field: "englishTestScore", question: "What was your score?", subtitle: "Skip if you haven't taken it yet", type: "text", placeholder: "e.g. 7.5 (IELTS), 100 (TOEFL)", section: "Test Prep" },
  // Visa
  { id: "q23", field: "hasAppliedVisa", question: "Have you ever applied for a visa?", type: "toggle", section: "Visa" },
  { id: "q24", field: "familyAppliedVisa", question: "Has anyone in your family applied for a visa?", type: "toggle", section: "Visa" },
  { id: "q25", field: "hasRelativesInStudyCountry", question: "Do you have relatives in the country you want to study in?", type: "toggle", section: "Visa" },
  { id: "q26", field: "hasPermanentResidency", question: "Do you have permanent residency in any country?", subtitle: "Applied or approved", type: "toggle", section: "Visa" },
  // Funding
  { id: "q27", field: "fundingSource", question: "Who will fund your study?", type: "text", placeholder: "e.g. Parents, Self, LPDP Scholarship, Company", section: "Funding" },
  { id: "q28", field: "studyBudget", question: "What is your study budget?", subtitle: "Approximate annual budget", type: "select", options: ["Government / Scholarship", "Institution covers", "< 10K USD", "10 – 20K USD", "20 – 30K USD", "30 – 40K USD", "> 40K USD"], section: "Funding" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"];

// ── Profile type ──────────────────────────────────────────────
interface ProfileData {
  [key: string]: string | boolean;
}

const buildEmptyProfile = (): ProfileData => {
  const p: ProfileData = {};
  QUESTIONS.forEach((q) => {
    p[q.field] = q.type === "toggle" ? false : "";
  });
  return p;
};

// ── Component ─────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [current, setCurrent] = useState(0);
  const [profile, setProfile] = useState<ProfileData>(buildEmptyProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);
  // month-year split state
  const [intakeMonth, setIntakeMonth] = useState("");
  const [intakeYear, setIntakeYear] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const total = QUESTIONS.length;
  const q = QUESTIONS[current];
  const progress = ((current + 1) / total) * 100;
  const isLast = current === total - 1;

  // Sync month-year back to profile
  useEffect(() => {
    if (intakeMonth || intakeYear) {
      const val = [intakeMonth, intakeYear].filter(Boolean).join(" ");
      setProfile((prev) => ({ ...prev, preferredEarliestIntake: val }));
    }
  }, [intakeMonth, intakeYear]);

  // Auto-focus input on step change
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, [current]);

  const updateField = (field: string, value: string | boolean) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= total || animating) return;
    setDirection(idx > current ? "next" : "prev");
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 200);
  }, [current, total, animating]);

  const handleNext = useCallback(() => {
    if (!isLast) goTo(current + 1);
  }, [isLast, goTo, current]);

  const handleBack = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  const handleComplete = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
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

  // Keyboard: Enter to next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && q.type !== "textarea") {
        e.preventDefault();
        if (isLast) {
          handleComplete();
        } else {
          handleNext();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLast, handleNext, q?.type]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Unique sections for dots
  const sections = [...new Set(QUESTIONS.map((q) => q.section))];
  const currentSection = q.section;

  const value = profile[q.field];

  // ── Intro screen ──
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6">
        <div className="max-w-md text-center space-y-6">
          <span className="text-sm font-semibold text-[var(--primary)] tracking-wide">SATU TUJU</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
            Hey there!<br />Welcome to SatuTuju
          </h1>
          <p className="text-gray-500 text-base sm:text-lg leading-relaxed">
            Before we start, let&apos;s get to know you a little deeper so we can
            understand you better and personalise your study-abroad journey.
          </p>
          <p className="text-sm text-gray-400">
            This will only take a few minutes.
          </p>
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
          <span className="text-xs text-gray-400">{current + 1} / {total}</span>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* Section pills */}
        <div className="max-w-2xl mx-auto mt-3 flex gap-2 flex-wrap">
          {sections.map((s) => (
            <span
              key={s}
              className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                s === currentSection
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
            {/* Question number */}
            <p className="text-xs text-[var(--primary)] font-semibold mb-2 tracking-wide">
              QUESTION {current + 1}
            </p>

            {/* Question text */}
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-1">
              {q.question}
            </h2>
            {q.subtitle && (
              <p className="text-sm text-gray-400 mb-6">{q.subtitle}</p>
            )}
            {!q.subtitle && <div className="mb-6" />}

            {/* Input */}
            <div className="mt-2">
              {(q.type === "text" || q.type === "tel") && (
                <input
                  ref={inputRef as React.Ref<HTMLInputElement>}
                  type={q.type === "tel" ? "tel" : "text"}
                  value={(value as string) || ""}
                  onChange={(e) => updateField(q.field, e.target.value)}
                  placeholder={q.placeholder || "Type your answer..."}
                  className="w-full text-lg px-0 py-3 border-0 border-b-2 border-gray-200 bg-transparent focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-gray-300"
                />
              )}

              {q.type === "date" && (
                <input
                  ref={inputRef as React.Ref<HTMLInputElement>}
                  type="date"
                  value={(value as string) || ""}
                  onChange={(e) => updateField(q.field, e.target.value)}
                  className="w-full text-lg px-0 py-3 border-0 border-b-2 border-gray-200 bg-transparent focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              )}

              {q.type === "textarea" && (
                <textarea
                  ref={inputRef as React.Ref<HTMLTextAreaElement>}
                  value={(value as string) || ""}
                  onChange={(e) => updateField(q.field, e.target.value)}
                  placeholder={q.placeholder || "Type your answer..."}
                  rows={3}
                  className="w-full text-lg px-0 py-3 border-0 border-b-2 border-gray-200 bg-transparent focus:outline-none focus:border-[var(--primary)] transition-colors placeholder:text-gray-300 resize-none"
                />
              )}

              {q.type === "select" && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => updateField(q.field, opt)}
                      className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        value === opt
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {value === opt && <span className="mr-2">✓</span>}
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "toggle" && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => updateField(q.field, true)}
                    className={`flex-1 py-4 rounded-xl border-2 text-base font-semibold transition-all ${
                      value === true
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => updateField(q.field, false)}
                    className={`flex-1 py-4 rounded-xl border-2 text-base font-semibold transition-all ${
                      value === false
                        ? "border-gray-400 bg-gray-100 text-gray-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    No
                  </button>
                </div>
              )}

              {q.type === "month-year" && (
                <div className="flex gap-3 mt-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Month</label>
                    <select
                      value={intakeMonth}
                      onChange={(e) => setIntakeMonth(e.target.value)}
                      className="w-full text-base px-3 py-3 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                    >
                      <option value="">Select month...</option>
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Year</label>
                    <select
                      value={intakeYear}
                      onChange={(e) => setIntakeYear(e.target.value)}
                      className="w-full text-base px-3 py-3 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                    >
                      <option value="">Select year...</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Hint */}
            {q.type !== "toggle" && q.type !== "select" && (
              <p className="text-xs text-gray-300 mt-4">
                Press <span className="font-medium text-gray-400">Enter ↵</span> to continue, or skip if not applicable
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="px-4 sm:px-8 pb-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {current > 0 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 px-4 py-2.5 rounded-lg hover:bg-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                onClick={handleNext}
                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 transition"
              >
                Skip
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex items-center gap-2 text-sm text-white bg-[var(--primary)] hover:opacity-90 px-6 py-2.5 rounded-lg transition font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Complete Setup"}
                {!saving && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1 text-sm text-white bg-[var(--primary)] hover:opacity-90 px-5 py-2.5 rounded-lg transition font-medium"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
