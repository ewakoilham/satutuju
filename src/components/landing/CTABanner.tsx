import Link from "next/link";
import Image from "next/image";
import Icon from "@/components/ui/Icon";
import { landingCopy, COMMUNITY_URL } from "@/lib/landing-copy";

export default function CTABanner() {
  const t = landingCopy.id.finalCta;
  return (
    <section className="relative bg-primary py-20 overflow-hidden">
      {/* Organic gradient blobs */}
      <div
        className="absolute -top-20 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#2e4a9a", filter: "blur(100px)", opacity: 0.6 }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-[450px] h-[450px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#4f64b1", filter: "blur(100px)", opacity: 0.5, animationDelay: "3s", animationDirection: "reverse" }}
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
