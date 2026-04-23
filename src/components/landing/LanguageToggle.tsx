"use client";

import { useLang, type Lang } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();

  const Option = ({ value, label }: { value: Lang; label: string }) => {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        aria-pressed={active}
        className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all ${
          active
            ? "bg-white text-primary shadow-sm"
            : "text-primary-700/70 hover:text-primary"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-primary-50 border border-primary-100"
    >
      <Option value="id" label="ID" />
      <Option value="en" label="EN" />
    </div>
  );
}
