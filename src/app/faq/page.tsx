import type { Metadata } from "next";
import MarketingPage from "@/components/marketing/MarketingPage";
import { FAQS } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQ — Satu Tuju",
  description: "Pertanyaan umum tentang program mentorship beasiswa Satu Tuju.",
};

export default function FaqPage() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Pertanyaan yang sering ditanyakan."
      subtitle="Jawaban singkat untuk hal-hal yang biasanya kamu pikirkan sebelum mendaftar."
    >
      <div className="not-prose space-y-3">
        {FAQS.map((item, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-border/70 bg-white px-5 py-4 hover:border-primary-200 transition-colors"
          >
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-foreground font-[family-name:var(--font-heading)]">
              {item.q}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-text-muted group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-text-muted">
        Belum ketemu jawabannya?{" "}
        <a
          href="mailto:hello@satutuju.id"
          className="text-primary font-medium underline underline-offset-2"
        >
          hello@satutuju.id
        </a>
      </p>
    </MarketingPage>
  );
}
