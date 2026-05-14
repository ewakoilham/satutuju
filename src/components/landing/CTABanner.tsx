import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy, COMMUNITY_URL } from "@/lib/landing-copy";

export default function CTABanner() {
  const t = landingCopy.id.finalCta;
  return (
    <section className="relative bg-primary py-20 overflow-hidden">
      {/* Mesh of soft highlights — lighter blues/purples/cyan tints on top
          of the navy base create dimensional depth instead of a flat fill. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 65% 55% at 18% 8%, rgba(180, 200, 255, 0.18), transparent 65%),
            radial-gradient(ellipse 60% 50% at 82% 92%, rgba(150, 130, 220, 0.16), transparent 65%),
            radial-gradient(ellipse 45% 40% at 92% 18%, rgba(120, 200, 240, 0.13), transparent 70%),
            radial-gradient(ellipse 50% 40% at 8% 88%, rgba(200, 180, 255, 0.12), transparent 70%)
          `,
        }}
      />

      {/* Animated blobs — motion layered over the static mesh */}
      <div
        className="absolute -top-20 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#2e4a9a", filter: "blur(100px)", opacity: 0.55 }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-[450px] h-[450px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#4f64b1", filter: "blur(100px)", opacity: 0.45, animationDelay: "3s", animationDirection: "reverse" }}
      />
      <div
        className="absolute top-1/3 -right-32 w-[360px] h-[360px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#5c4b9e", filter: "blur(110px)", opacity: 0.3, animationDelay: "5s" }}
      />
      <div
        className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#3a6a96", filter: "blur(100px)", opacity: 0.28, animationDelay: "7s", animationDirection: "reverse" }}
      />

      {/* Grain/noise — soft-light blend works on dark backgrounds without
          becoming bright dots. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-soft-light opacity-[0.25]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Edge vignette — darker at corners for focus pull on a dark background. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 95% 75% at center, transparent 50%, rgba(0, 0, 0, 0.28) 100%)",
        }}
      />

      {/* Decorative illustrations */}
      <Image
        src="/illustrations/puzzle-piece.png"
        alt=""
        width={200}
        height={210}
        className="absolute -right-10 -top-10 opacity-10 pointer-events-none rotate-12 animate-float"
      />
      <Image
        src="/illustrations/puzzle-group.png"
        alt=""
        width={150}
        height={150}
        className="absolute -left-8 -bottom-8 opacity-10 pointer-events-none -rotate-12 animate-float"
        style={{ animationDelay: "2s" }}
      />
      <Image
        src="/illustrations/globe.png"
        alt=""
        width={90}
        height={90}
        className="absolute top-8 left-1/4 opacity-[0.06] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "1s" }}
      />
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={70}
        height={70}
        className="absolute bottom-8 right-1/4 opacity-[0.06] pointer-events-none animate-float hidden lg:block"
        style={{ animationDelay: "3s" }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <Image
          src="/logo-main-white.png"
          alt="SatuTuju"
          width={80}
          height={54}
          className="mx-auto mb-6 opacity-80"
        />

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight font-[family-name:var(--font-heading)]">
          {t.headline}
        </h2>
        <p className="mt-4 text-primary-200/90 text-lg max-w-2xl mx-auto">
          {t.subheading}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary font-bold rounded-xl hover:bg-primary-50 shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] transition-all text-base"
          >
            {t.primary}
            <Icon name="arrow-right" size={18} />
          </Link>
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent text-white font-semibold rounded-xl border-2 border-white/30 hover:border-white/60 hover:bg-white/10 transition-all text-base"
          >
            {t.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
