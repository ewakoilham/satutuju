"use client";

import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { landingCopy } from "@/lib/landing-copy";

export default function Navbar() {
  const t = landingCopy.id.nav;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md shadow-[var(--shadow-sm)] border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0">
            <Logo variant="main" size="sm" />
          </Link>

          {/* Always visible — Tentang Kami + Login, from the first section. */}
          <div className="flex items-center gap-1 sm:gap-3">
            <Link
              href="/about"
              className="text-sm font-medium text-primary-700 hover:text-primary-800 px-3 py-2 rounded-lg transition"
            >
              {t.about}
            </Link>
            <Link href="/login" className="btn-primary px-5 py-2.5 rounded-xl text-sm">
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
