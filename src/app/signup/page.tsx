"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import Logo from "@/components/ui/Logo";
import Icon from "@/components/ui/Icon";

export default function SignupPage() {
  return (
    <div className="force-light min-h-screen bg-brand-blue-soft relative overflow-hidden px-4 py-10">
      {/* Decorative illustrations */}
      <Image
        src="/illustrations/lightbulb.png"
        alt=""
        width={130}
        height={130}
        className="absolute top-12 left-16 opacity-15 pointer-events-none hidden md:block"
      />
      <Image
        src="/illustrations/notebook.png"
        alt=""
        width={110}
        height={110}
        className="absolute top-16 right-12 opacity-10 pointer-events-none hidden md:block"
      />
      <Image
        src="/illustrations/globe.png"
        alt=""
        width={140}
        height={140}
        className="absolute bottom-16 right-16 opacity-15 pointer-events-none hidden md:block"
      />

      <div className="relative max-w-2xl mx-auto">
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

        {/* Header */}
        <div className="text-center mb-6">
          <Logo variant="main" size="md" className="mx-auto mb-2" />
          <p className="text-sm text-primary-600/70">Mentorship Platform</p>
        </div>

        {/* Card */}
        <div className="card shadow-[var(--shadow-lg)] border-brand-lavender/30 p-6 sm:p-8 rounded-2xl bg-white/95 backdrop-blur-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-yellow/60 rounded-2xl mb-3">
              <Icon name="graduation" size={22} className="text-primary" />
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
