"use client";

import Link from "next/link";

/**
 * Phase 18 — sub-nav tabs between the admin contract pages (Mentor vs
 * Mentee). Phase 19 adds the mentee deposit verification page as a third
 * tab. Lightweight in-page nav so admin always knows which set they're
 * viewing.
 */
interface Props {
  active: "mentor" | "mentee" | "deposits";
}

export default function AdminContractsSubNav({ active }: Props) {
  return (
    <nav className="flex items-center gap-2 text-sm border-b border-border pb-3">
      <Tab href="/dashboard/admin/contracts" label="Kontrak Mentor" active={active === "mentor"} />
      <Tab href="/dashboard/admin/mentee-contracts" label="Kontrak Mentee" active={active === "mentee"} />
      <Tab href="/dashboard/admin/deposits" label="Deposit Mentee" active={active === "deposits"} />
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
      {label}
    </Link>
  );
}
