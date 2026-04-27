"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { landingCopy } from "@/lib/landing-copy";

export default function Navbar() {
  const [pastHero, setPastHero] = useState(false);
  const t = landingCopy.id.nav;

  // CTA shows only after the user scrolls past (most of) the hero — the hero's
  // own CTAs make the navbar button redundant while it is in view.
  useEffect(() => {
    const onScroll = () => {
      setPastHero(window.scrollY > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md shadow-[var(--shadow-sm)] border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0">
            <Logo variant="main" size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              aria-hidden={!pastHero}
              tabIndex={pastHero ? 0 : -1}
              className={`btn-primary px-5 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                pastHero
                  ? "opacity-100 translate-y-0 pointer-events-auto"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              {t.join}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
