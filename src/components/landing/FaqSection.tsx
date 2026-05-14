import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { FAQS } from "@/lib/faqs";

export default function FaqSection() {
  return (
    <section id="faq" className="py-24 bg-surface relative overflow-hidden">
      {/* Organic gradient blobs */}
      <div
        className="absolute -top-24 -right-20 w-[450px] h-[450px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(120px)", opacity: 0.55 }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[420px] h-[420px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(110px)", opacity: 0.45, animationDelay: "3s", animationDirection: "reverse" }}
      />

      {/* Brand illustrations */}
      <Image
        src="/illustrations/open-book.png"
        alt=""
        width={90}
        height={90}
        className="absolute top-16 left-12 opacity-[0.06] pointer-events-none animate-float hidden lg:block"
      />
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={80}
        height={80}
        className="absolute bottom-20 right-16 opacity-[0.06] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "1.8s" }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-sm text-primary-700 font-medium mb-4">
            <Icon name="lightbulb" size={16} />
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground font-[family-name:var(--font-heading)]">
            Pertanyaan yang sering ditanyakan.
          </h2>
          <p className="mt-4 text-text-muted text-lg">
            Jawaban singkat untuk hal-hal yang biasanya kamu pikirkan sebelum mendaftar.
          </p>
        </div>

        <div className="space-y-3">
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
      </div>
    </section>
  );
}
