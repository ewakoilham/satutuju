"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Logo from "@/components/ui/Logo";

// ── Question definitions ──────────────────────────────────────
type QType =
  | "text"
  | "select"
  | "select-other"   // select with free-text "Other" option
  | "multiselect";   // checkboxes, optional maxSelect

interface Question {
  id: string;
  field: string;
  otherField?: string;   // companion field when "Lainnya" is chosen
  question: string;
  subtitle?: string;
  type: QType;
  options?: string[];
  optionValues?: string[]; // parallel to options (stored value)
  maxSelect?: number;
  section: string;
}

const QUESTIONS: Question[] = [
  // ── Pengalaman Studi ──────────────────────────────────────────
  {
    id: "m1", field: "fullName", section: "Pengalaman Studi",
    question: "Siapa nama lengkap kamu?",
    subtitle: "Sesuai yang tertera di kartu identitas kamu",
    type: "text",
  },
  {
    id: "m2", field: "city", section: "Pengalaman Studi",
    question: "Kamu tinggal di kota mana?",
    subtitle: "Kota atau domisili kamu saat ini",
    type: "text",
  },
  // S1 dipisah jadi 3: Studi · Kampus · Gelar
  {
    id: "m3", field: "undergradMajor", section: "Pengalaman Studi",
    question: "Studi S1 Kamu",
    subtitle: "Program atau bidang studi sarjana — misalnya Teknik Kimia",
    type: "text",
  },
  {
    id: "m4", field: "undergradUniversity", section: "Pengalaman Studi",
    question: "Kampus S1 Kamu",
    subtitle: "Nama kampus dan negara — misalnya Universitas Indonesia, Indonesia",
    type: "text",
  },
  {
    id: "m3d", field: "undergradDegree", section: "Pengalaman Studi",
    question: "Gelar S1 Kamu",
    subtitle: "Gelar yang kamu peroleh — misalnya Sarjana Teknik (S.T.)",
    type: "text",
  },
  {
    id: "m5", field: "postgradMajor", section: "Pengalaman Studi",
    question: "Apa jurusan dan gelar S2 kamu?",
    subtitle: "misalnya Master of Public Policy",
    type: "text",
  },
  {
    id: "m6", field: "postgradUniversity", section: "Pengalaman Studi",
    question: "Di mana kamu menempuh studi S2?",
    subtitle: "Nama kampus dan negara — misalnya University of Melbourne, Australia",
    type: "text",
  },
  {
    id: "m7", field: "fundingScheme", otherField: "fundingOther", section: "Pengalaman Studi",
    question: "Bagaimana studi S2 kamu didanai?",
    type: "select-other",
    options: ["Beasiswa LPDP", "Biaya sendiri", "Lainnya"],
    optionValues: ["lpdp", "self-funded", "other"],
  },
  {
    id: "m8", field: "currentField", otherField: "currentFieldOther", section: "Pengalaman Studi",
    question: "Kamu saat ini bekerja di bidang apa?",
    type: "select-other",
    options: [
      "Teknologi & Rekayasa",
      "Bisnis & Manajemen",
      "Keuangan & Perbankan",
      "Konsultan",
      "Kesehatan & Kedokteran",
      "Pendidikan & Riset",
      "Pemerintahan & Kebijakan Publik",
      "Lainnya",
    ],
    optionValues: [
      "technology", "business", "finance", "consulting",
      "health", "education", "government", "other",
    ],
  },

  // ── Preferensi Mentoring ──────────────────────────────────────
  {
    id: "m12", field: "mentorStyle", section: "Preferensi Mentoring",
    question: "Bagaimana gaya mentoring kamu?",
    type: "select",
    options: ["Lembut", "Cenderung lembut", "Tidak ada preferensi", "Cenderung tegas", "Tegas"],
    optionValues: ["gentle", "somewhat-gentle", "no-preference", "somewhat-direct", "direct"],
  },
  {
    id: "m13", field: "workStyle", section: "Preferensi Mentoring",
    question: "Bagaimana gaya kerja kamu saat sesi?",
    type: "select",
    options: ["Terstruktur", "Cenderung terstruktur", "Tidak ada preferensi", "Cenderung fleksibel", "Fleksibel"],
    optionValues: ["structured", "somewhat-structured", "no-preference", "somewhat-flexible", "flexible"],
  },
  {
    id: "m14", field: "communicationStyle", section: "Preferensi Mentoring",
    question: "Gaya komunikasi apa yang kamu sukai?",
    type: "select",
    options: ["Formal", "Cenderung formal", "Tidak ada preferensi", "Cenderung santai", "Santai"],
    optionValues: ["formal", "somewhat-formal", "no-preference", "somewhat-casual", "casual"],
  },
  {
    id: "m15", field: "primaryRoles", section: "Preferensi Mentoring",
    question: "Apa pendekatan mentoring utama kamu?",
    subtitle: "Pilih maksimal 2",
    type: "multiselect",
    maxSelect: 2,
    options: [
      "Pendengar — beri mentee ruang untuk berefleksi",
      "Pemecah masalah — bantu temukan solusi konkret",
      "Penantang — dorong mentee keluar dari zona nyaman",
      "Motivator — jaga semangat dan rasa percaya dirinya",
      "Penasihat — bagikan pengalaman dan perspektif pribadi",
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
      setError("Mohon jawab pertanyaan ini sebelum menyelesaikan profil kamu.");
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
        setError(data.error || "Gagal menyimpan profil");
        setSaving(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Koneksi bermasalah. Coba lagi ya.");
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
  const currentSection = q.section;

  // Section is "passed" once we've moved beyond it — used to show a check.
  const isSectionPassed = (section: string): boolean =>
    sections.indexOf(section) < sections.indexOf(currentSection);

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
          <Logo variant="main" size="lg" className="mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight font-[family-name:var(--font-heading)]">
            Selamat datang, Mentor!
          </h1>
          <p className="text-text-muted text-base sm:text-lg leading-relaxed">
            Sebelum mulai, yuk lengkapi profil mentor kamu agar mentee dan tim admin bisa lebih mengenal kamu.
          </p>
          <p className="text-sm text-text-muted-2">Hanya butuh beberapa menit kok.</p>
          <button
            onClick={() => setShowIntro(false)}
            className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition text-base"
          >
            Mulai
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
          <Logo variant="main" size="sm" />
          <span className="text-xs text-text-muted-2">{current + 1} / {total}</span>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-3">
          <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-deep rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* Section pills */}
        <div className="max-w-2xl mx-auto mt-3 flex gap-2 flex-wrap">
          {sections.map((s) => {
            const passed = isSectionPassed(s);
            return (
              <span
                key={s}
                className={`text-xs px-2.5 py-1 rounded-full transition-all inline-flex items-center gap-1 ${
                  s === currentSection
                    ? "bg-brand-blue-soft text-primary font-medium"
                    : "bg-surface text-text-muted-2 border border-border"
                }`}
              >
                {passed && <Icon name="check" size={12} className="text-primary" />}
                {s}
              </span>
            );
          })}
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <div className={`transition-all duration-200 ease-out ${
            animating ? (direction === "next" ? "opacity-0 translate-x-8" : "opacity-0 -translate-x-8") : "opacity-100 translate-x-0"
          }`}>
            <p className="text-xs text-primary font-semibold mb-2 tracking-wide">PERTANYAAN {current + 1}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-1 font-[family-name:var(--font-heading)]">{q.question}</h2>
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
                className="input-field"
                placeholder="Ketik jawaban kamu..."
              />
            )}

            {/* ── select ── */}
            {/* Ordered spectrum (e.g. Tegas … Lembut) — render vertically and
                in order so the scale reads top-to-bottom, not jumbled across
                two columns. */}
            {q.type === "select" && (
              <div className="grid grid-cols-1 gap-2 mt-2">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt;
                  const selected = profile[q.field] === val;
                  return (
                    <button key={opt} onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                      className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        selected
                          ? "border-primary bg-primary text-white scale-[1.02]"
                          : "border-border bg-surface text-foreground hover:border-gray-300 hover:bg-surface-elevated"
                      }`}>
                      {selected && <Icon name="check" size={14} className="inline mr-2" />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── select-other ── */}
            {q.type === "select-other" && (
              <div className="space-y-2 mt-2">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt.toLowerCase();
                  const isOther = val === "other";
                  const selected = profile[q.field] === val;
                  return (
                    <div key={opt}>
                      <button onClick={() => setProfile((p) => ({ ...p, [q.field]: val }))}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          selected
                            ? "border-primary bg-primary text-white scale-[1.02]"
                            : "border-border bg-surface text-foreground hover:border-gray-300 hover:bg-surface-elevated"
                        }`}>
                        {selected && <Icon name="check" size={14} className="inline mr-2" />}
                        {opt}
                      </button>
                      {isOther && profile[q.field] === "other" && q.otherField && (
                        <input
                          type="text"
                          value={profile[q.otherField] || ""}
                          onChange={(e) => setProfile((p) => ({ ...p, [q.otherField!]: e.target.value }))}
                          placeholder="Sebutkan..."
                          className="input-field mt-2"
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
              <div className="grid grid-cols-1 gap-2 mt-2">
                {(q.options || []).map((opt, i) => {
                  const val = q.optionValues?.[i] ?? opt;
                  const selected = getMultiselectValues().includes(val);
                  return (
                    <button key={opt} onClick={() => toggleMultiselect(val)}
                      className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3 ${
                        selected
                          ? "border-primary bg-primary text-white scale-[1.02]"
                          : "border-border bg-surface text-foreground hover:border-gray-300 hover:bg-surface-elevated"
                      }`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? "bg-white border-white" : "border-gray-300"
                      }`}>
                        {selected && <Icon name="check" size={12} className="text-primary" />}
                      </span>
                      {opt}
                    </button>
                  );
                })}
                {q.maxSelect && (
                  <p className="text-xs text-text-muted-2 mt-1">
                    {getMultiselectValues().length}/{q.maxSelect} dipilih
                  </p>
                )}
              </div>
            )}

            {/* Hint */}
            {q.type === "text" && (
              <p className="text-xs text-text-muted-2 mt-4">
                Tekan <span className="font-medium text-text-muted-2">Enter ↵</span> untuk lanjut
              </p>
            )}

            {error && (
              <div className="mt-6 bg-red-50 text-danger text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="px-4 sm:px-8 pb-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {current > 0 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-text-muted-2 hover:text-foreground px-4 py-2.5 rounded-lg hover:bg-surface transition"
            >
              <Icon name="chevron-left" size={16} />
              Kembali
            </button>
          ) : (
            <div />
          )}

          {isLast ? (
            <button
              onClick={handleComplete}
              disabled={saving || !currentAnswered}
              className="flex items-center gap-2 text-sm text-white bg-primary hover:opacity-90 px-6 py-2.5 rounded-lg transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Menyimpan..." : "Selesaikan Profil"}
              {!saving && <Icon name="check" size={16} />}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!currentAnswered}
              className="flex items-center gap-1 text-sm text-white bg-primary hover:opacity-90 px-5 py-2.5 rounded-lg transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Lanjut
              <Icon name="chevron-right" size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
