"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { landingCopy } from "@/lib/landing-copy";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const t = landingCopy.id.nav;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/80 backdrop-blur-md ${
        scrolled
          ? "shadow-[var(--shadow-sm)] border-b border-border/50"
          : ""
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
