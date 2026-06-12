"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

interface ContractStateAPI {
  contract: {
    status: string; // "PENDING_SIGNATURE" | "SIGNED" | "VOID"
    templateVersion: string;
  } | null;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  needsResign: boolean;
}

interface Props {
  /** Current logged-in user role. Only mentors get a banner. */
  role: string | undefined;
}

/**
 * Layout-level contract alert — MENTOR ONLY.
 *
 * Mentors still get the sticky banner nudging them to sign / re-sign their
 * Perjanjian Kemitraan. Mentees do NOT: Phase 19.1 hard-gates the entire
 * mentee dashboard (see MenteePrereqGate), which is a stronger and clearer
 * mechanism than a banner — so the mentee banner would just be redundant
 * chrome. The mentee's resign notification still fires server-side from the
 * gate's prereq fetch (GET /api/mentee-contract?summary=1).
 *
 * Hides itself on the mentor's own contract page; the same GET also lazily
 * inserts a Notification row when the version is stale.
 */

const MENTOR_CONFIG = {
  endpoint: "/api/mentor-contract?summary=1",
  href: "/dashboard/contract",
  contractName: "Perjanjian Kemitraan Mentor",
  hidePath: "/dashboard/contract",
};

export default function DashboardContractAlert({ role }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<ContractStateAPI | null>(null);
  const isMentor = role === "mentor";

  useEffect(() => {
    if (!isMentor) return;
    // Skip while on the contract page (the banner is hidden there anyway)
    // so we refresh exactly when the mentor leaves it after signing.
    if (pathname === MENTOR_CONFIG.hidePath) return;
    let cancelled = false;
    fetch(MENTOR_CONFIG.endpoint, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ContractStateAPI | null) => { if (!cancelled) setState(d); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [isMentor, pathname]);

  if (!isMentor) return null;
  if (pathname === MENTOR_CONFIG.hidePath) return null;
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
        body: `Mohon tanda tangan ulang ${MENTOR_CONFIG.contractName} sebelum melakukan aktivitas lainnya.`,
      };
    }
    return {
      title: `Anda belum menandatangani ${MENTOR_CONFIG.contractName}`,
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
          href={MENTOR_CONFIG.href}
          className="btn-primary inline-flex items-center justify-center whitespace-nowrap text-sm"
        >
          Buka Kontrak
        </Link>
      </div>
    </div>
  );
}
