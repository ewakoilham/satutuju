"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";

/**
 * Sub-navigation strip rendered at the top of every pipeline page.
 *
 * Replaces the old admin-nav dropdown (New Leads / Tambah / Pipeline
 * Steps / Email Templates / Auto-Send). The main "Pipeline" tab in the
 * admin ribbon now goes straight to /dashboard/admin/new-leads, and
 * navigation between pipeline subpages happens here.
 */

interface SubnavItem {
  href: string;
  label: string;
  icon: string;
  /** When true, only match exact href (used for the inbox root so that
   *  child routes like /:id don't keep the inbox tab highlighted). */
  exact?: boolean;
}

const ITEMS: SubnavItem[] = [
  { href: "/dashboard/admin/new-leads",           label: "Leads",           icon: "users",    exact: true },
  { href: "/dashboard/admin/new-leads/new",       label: "Tambah Lead",     icon: "plus"     },
  { href: "/dashboard/admin/new-leads/pipeline",  label: "Pipeline Steps",  icon: "check"    },
  { href: "/dashboard/admin/new-leads/templates", label: "Email Templates", icon: "document" },
  { href: "/dashboard/admin/new-leads/settings",  label: "Auto-Send",       icon: "calendar" },
];

export default function PipelineSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              active
                ? "bg-primary-50 text-primary"
                : "text-text-muted hover:bg-surface-elevated/60 hover:text-foreground"
            }`}
          >
            <Icon name={item.icon} size={13} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
