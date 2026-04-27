"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { landingCopy } from "@/lib/landing-copy";

export default function Navbar() {
  const [visible, setVisible] = useState(false);
  const t = landingCopy.id.nav;

  // Reveal the navbar only after the user has scrolled past (most of) the hero.
  // Using viewport height as the threshold keeps this in sync with the hero's
  // min-h-[90vh] / lg:min-h-screen sizing without coupling to a specific element.
  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.85;
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-hidden={!visible}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/85 backdrop-blur-md shadow-[var(--shadow-sm)] border-b border-border/50 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0">
            <Logo variant="main" size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/signup"
              className="btn-primary px-5 py-2.5 rounded-xl text-sm"
            >
              {t.join}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
