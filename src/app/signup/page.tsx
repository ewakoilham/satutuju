"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";
import { BG_PHOTOS } from "@/lib/landing-bg-photos";

export default function SignupPage() {
  // Random hero-style background picked on mount. Server-render keeps the
  // image off (to avoid hydration mismatch), white wash + blobs already
  // provide atmosphere until the photo fades in.
  const [bgIndex, setBgIndex] = useState<number | null>(null);
  useEffect(() => {
    // Deferred out of the synchronous effect body (react-hooks lint); still
    // client-only so the server render stays image-less (hydration-safe).
    const raf = requestAnimationFrame(() => {
      setBgIndex(Math.floor(Math.random() * BG_PHOTOS.length));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="force-light min-h-screen bg-white relative overflow-hidden px-4 py-10">
      {/* Background photo — random from the hero pool */}
      {bgIndex !== null && (
        <Image
          src={BG_PHOTOS[bgIndex]}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover pointer-events-none select-none"
        />
      )}
      {/* Soft white wash so the card + text stay legible over the photo */}
      <div className="absolute inset-0 bg-white/70 pointer-events-none" />

      {/* Organic gradient blobs — same palette as the landing hero */}
      <div
        className="absolute -top-20 -right-20 w-[600px] h-[600px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#c6ddef", filter: "blur(120px)", opacity: 0.7 }}
      />
      <div
        className="absolute -bottom-32 -left-20 w-[550px] h-[550px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#d5c6ef", filter: "blur(120px)", opacity: 0.5, animationDelay: "3s", animationDirection: "reverse" }}
      />
      <div
        className="absolute top-10 left-1/4 w-[400px] h-[400px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#fef3d0", filter: "blur(100px)", opacity: 0.6, animationDelay: "5s" }}
      />
      <div
        className="absolute bottom-10 right-1/3 w-[350px] h-[350px] rounded-full pointer-events-none animate-blob-drift"
        style={{ background: "#b8d4ed", filter: "blur(100px)", opacity: 0.5, animationDelay: "7s", animationDirection: "reverse" }}
      />

      {/* Existing decorative illustrations — opacities reduced so they sit
          well over the new photo + blob layering. */}
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={130}
        height={130}
        className="absolute top-12 left-16 opacity-[0.10] pointer-events-none hidden md:block"
      />
      <Image
        src="/illustrations/notebook.png"
        alt=""
        width={110}
        height={110}
        className="absolute top-16 right-12 opacity-[0.08] pointer-events-none hidden md:block"
      />
      <Image
        src="/illustrations/globe.png"
        alt=""
        width={140}
        height={140}
        className="absolute bottom-16 right-16 opacity-[0.10] pointer-events-none hidden md:block"
      />

      <div className="relative max-w-2xl mx-auto z-10">
        {/* Back to landing */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-700 transition-colors"
          >
            <Icon name="arrow-right" size={16} className="rotate-180" />
            Kembali ke Beranda
          </Link>
        </div>

        {/* Card */}
        <div className="card shadow-[var(--shadow-lg)] border-brand-lavender/30 px-6 sm:px-8 pt-8 pb-6 sm:pt-10 sm:pb-8 rounded-2xl bg-white/95 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center bg-brand-yellow/60 rounded-2xl mb-3 px-4 py-2">
              <Logo variant="main" size="xs" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Daftar sebagai Mentee
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Ready to fulfill your dreams with Satu Tuju?
            </p>
          </div>

          {/* Tally embed */}
          <iframe
            data-tally-src="https://tally.so/embed/9qO65Q?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
            loading="lazy"
            width="100%"
            height={545}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
            title="Ready to fulfill your dreams with Satu Tuju?"
            className="w-full"
          />

          {/* Escape hatch: if the embed script is blocked (ad-blocker, strict
              privacy mode, corporate network) the iframe stays clipped at
              545px and the submit button can be unreachable. The direct form
              always works. */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Formulir tidak muncul atau terpotong?{" "}
            <a
              href="https://tally.so/r/9qO65Q"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-semibold underline hover:text-primary-700"
            >
              Buka formulir di tab baru →
            </a>
          </p>
        </div>
      </div>

      {/* Tally loader */}
      <Script id="tally-embed-loader" strategy="afterInteractive">
        {`
          var d=document,w="https://tally.so/widgets/embed.js",v=function(){"undefined"!=typeof Tally?Tally.loadEmbeds():d.querySelectorAll("iframe[data-tally-src]:not([src])").forEach((function(e){e.src=e.dataset.tallySrc}))};
          if("undefined"!=typeof Tally){v();}
          else if(d.querySelector('script[src="'+w+'"]')==null){var s=d.createElement("script");s.src=w;s.onload=v;s.onerror=v;d.body.appendChild(s);}
        `}
      </Script>
    </div>
  );
}
