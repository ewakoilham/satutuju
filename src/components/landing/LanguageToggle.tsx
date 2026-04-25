"use client";

import { useLang, type Lang } from "@/lib/i18n";

const OPTIONS: { value: Lang; label: string }[] = [
  { value: "id", label: "ID" },
  { value: "en", label: "EN" },
];

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const activeIndex = OPTIONS.findIndex((o) => o.value === lang);

  return (
    <div
      role="group"
      aria-label="Language"
      className="relative inline-flex items-center p-0.5 rounded-full bg-primary-50 border border-primary-100 hover:border-primary-200 hover:shadow-sm transition-[border-color,box-shadow] duration-200"
    >
      {/* Sliding indicator — animates between active option positions */}
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 w-9 rounded-full bg-white shadow-sm transition-transform duration-[450ms] ease-[cubic-bezier(0.68,-0.4,0.265,1.4)] will-change-transform"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {OPTIONS.map((opt) => {
        const active = lang === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLang(opt.value)}
            aria-pressed={active}
            aria-label={`Switch language to ${opt.label}`}
            title={`Switch to ${opt.label}`}
            className={`relative z-10 w-9 py-1 text-xs font-semibold rounded-full cursor-pointer transition duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 ${
              active
                ? "text-primary"
                : "text-primary-700/70 hover:text-primary hover:bg-white/40"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
