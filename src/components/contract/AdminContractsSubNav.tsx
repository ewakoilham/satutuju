"use client";

import Link from "next/link";

/**
 * Phase 18 — sub-nav tabs between the two admin contract pages
 * (Mentor vs Mentee). Lightweight in-page nav so admin always knows
 * which set they're viewing.
 */
interface Props {
  active: "mentor" | "mentee";
}

export default function AdminContractsSubNav({ active }: Props) {
  return (
    <nav className="flex items-center gap-2 text-sm border-b border-border pb-3">
      <Tab href="/dashboard/admin/contracts" label="Mentor" active={active === "mentor"} />
      <Tab href="/dashboard/admin/mentee-contracts" label="Mentee" active={active === "mentee"} />
    </nav>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-4 py-1.5 rounded-full transition ${
        active
          ? "bg-primary text-white font-semibold"
          : "bg-surface-elevated border border-border text-text-muted hover:text-foreground"
      }`}
    >
      Kontrak {label}
    </Link>
  );
}
