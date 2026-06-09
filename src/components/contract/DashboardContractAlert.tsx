"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

interface ContractStateAPI {
  contract: {
    status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
    templateVersion: string;
  } | null;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  needsResign: boolean;
}

interface Props {
  /** Current logged-in user role; alert renders for mentor + mentee. */
  role: string | undefined;
}

/**
 * Layout-level contract alert. Fetches the user's contract state on
 * every dashboard navigation and renders a sticky-ish banner above every
 * dashboard page when the user still owes us a signature OR a re-signature.
 *
 * Phase 18 — role-aware:
 *  - mentor → fetches /api/mentor-contract, links to /dashboard/contract
 *  - mentee → fetches /api/mentee-contract, links to /dashboard/mentee-contract
 *  - admin / other → no banner
 *
 * Hides itself on the user's own contract page. The same GET also lazily
 * inserts a Notification row server-side when the version is stale, so
 * the bell icon picks up the heads-up regardless of where the user lands.
 */

type RoleConfig = {
  endpoint: string;
  href: string;
  contractName: string;       // shown in banner copy
  hidePath: string;           // route where the banner shouldn't render
};

const ROLE_CONFIG: Record<string, RoleConfig> = {
  mentor: {
    endpoint: "/api/mentor-contract?summary=1",
    href: "/dashboard/contract",
    contractName: "Perjanjian Kemitraan Mentor",
    hidePath: "/dashboard/contract",
  },
  mentee: {
    endpoint: "/api/mentee-contract?summary=1",
    href: "/dashboard/mentee-contract",
    contractName: "Perjanjian Layanan Mentoring Mentee",
    hidePath: "/dashboard/mentee-contract",
  },
};

export default function DashboardContractAlert({ role }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<ContractStateAPI | null>(null);
  const config = role ? ROLE_CONFIG[role] : undefined;

  useEffect(() => {
    if (!config) return;
    // Re-fetch on every dashboard navigation. Skip while on the user's
    // own contract page (the banner is hidden there anyway) so we refresh
    // exactly when they leave it after signing.
    if (pathname === config.hidePath) return;
    let cancelled = false;
    fetch(config.endpoint, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ContractStateAPI | null) => { if (!cancelled) setState(d); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [config, pathname]);

  if (!config) return null;
  if (pathname === config.hidePath) return null;
  if (!state) return null;

  const status = state.contract?.status ?? null;
  const isSigned = status === "SIGNED";
  const identityFilled = state.identityCompleteness === state.identityRequired;

  let kind: "resign" | "void" | "unsigned" | null = null;
  if (state.needsResign) kind = "resign";
  else if (status === "VOID") kind = "void";
  else if (!isSigned) kind = "unsigned";

  if (!kind) return null;

  const { title, body } = (() => {
    if (kind === "resign") {
      return {
        title: `Kontrak diperbarui ke versi ${state.contractVersion} — perlu tanda tangan ulang`,
        body:
          state.contract
            ? `Tanda tangan Anda di versi ${state.contract.templateVersion} masih sah, namun kontrak ini penting untuk segera ditandatangani versi terbarunya sebelum aktivitas dilanjutkan.`
            : "Mohon tanda tangani versi terbaru sebelum melanjutkan aktivitas.",
      };
    }
    if (kind === "void") {
      return {
        title: "Kontrak Anda dibatalkan oleh admin",
        body: `Mohon tanda tangan ulang ${config.contractName} sebelum melakukan aktivitas lainnya.`,
      };
    }
    return {
      title: `Anda belum menandatangani ${config.contractName}`,
      body: !identityFilled
        ? "Lengkapi data identitas Anda lalu tanda tangani kontrak. Kontrak ini wajib ditandatangani sebelum aktivitas dilanjutkan."
        : "Data identitas Anda sudah lengkap — tinggal goreskan tanda tangan untuk menyelesaikan onboarding.",
    };
  })();

  return (
    <div className="border-b border-warning/40 bg-warning-light/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning shrink-0">
          <Icon name="bell" size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-text-muted leading-relaxed">{body}</p>
        </div>
        <Link
          href={config.href}
          className="btn-primary inline-flex items-center justify-center whitespace-nowrap text-sm"
        >
          Buka Kontrak
        </Link>
      </div>
    </div>
  );
}
