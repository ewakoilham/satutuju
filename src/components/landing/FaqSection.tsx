import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { FAQS } from "@/lib/faqs";

export default function FaqSection() {
  return (
    <section
      id="faq"
      className="py-24 relative overflow-hidden"
      style={{
        // Mesh of overlapping soft radials in the brand palette — creates
        // atmosphere & directional depth instead of a flat fill.
        background: `
          radial-gradient(ellipse 65% 55% at 18% 8%, rgba(254, 250, 239, 0.65), transparent 65%),
          radial-gradient(ellipse 60% 50% at 82% 92%, rgba(198, 221, 239, 0.55), transparent 65%),
          radial-gradient(ellipse 45% 40% at 92% 18%, rgba(213, 198, 239, 0.4), transparent 70%),
          radial-gradient(ellipse 50% 40% at 8% 88%, rgba(254, 243, 208, 0.4), transparent 70%),
          linear-gradient(180deg, #fafbfc 0%, #f5f7fb 100%)
        `,
      }}
    >
      {/* Animated blobs — motion on top of the static mesh */}
      <div
        className="absolute -top-32 -right-24 w-[500px] h-[500px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(120px)", opacity: 0.45 }}
      />
      <div
        className="absolute -bottom-28 -left-28 w-[460px] h-[460px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(110px)", opacity: 0.4, animationDelay: "3s", animationDirection: "reverse" }}
      />
      <div
        className="absolute top-1/3 -left-32 w-[380px] h-[380px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#d5c6ef", filter: "blur(110px)", opacity: 0.3, animationDelay: "5s" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(100px)", opacity: 0.25, animationDelay: "7s", animationDirection: "reverse" }}
      />

      {/* Grain/noise texture — SVG turbulence at low opacity gives the
          surface tactile depth without competing with content. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.18]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Soft edge vignette — darker at corners to focus attention inward. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 100% 80% at center, transparent 55%, rgba(17, 29, 66, 0.06) 100%)",
        }}
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
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

        {/* Two-column layout on lg+ to save vertical space. Split the array
            in half so an item expanding doesn't reflow items between columns
            (which would happen with CSS column-count). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 items-start">
          {[FAQS.slice(0, Math.ceil(FAQS.length / 2)), FAQS.slice(Math.ceil(FAQS.length / 2))].map(
            (col, colIdx) => (
              <div key={colIdx} className="space-y-3">
                {col.map((item, i) => (
                  <details
                    key={`${colIdx}-${i}`}
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
            ),
          )}
        </div>

        <p className="mt-10 text-center text-sm text-text-muted">
          Belum ketemu jawabannya? hubungi kami di{" "}
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
