"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { fetchMenteePrereqs } from "@/lib/mentee-prereq-cache";

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
  /** Current logged-in user role; mentor + mentee get (different) banners. */
  role: string | undefined;
}

/**
 * Layout-level contract alert.
 *
 *  - mentor → full nudge: unsigned / void / resign. Mentors aren't hard-gated,
 *    so the banner is their only prompt.
 *  - mentee → RESIGN ONLY. Phase 19.1 hard-gates the whole mentee dashboard
 *    for the blocking obligations (first-time signature + deposit), so those
 *    need no banner. But a re-sign (already signed, template version bumped)
 *    is deliberately NOT gated — the old signature stays valid — so it gets a
 *    soft banner reminder instead.
 *  - admin / other → nothing.
 *
 * Hides itself on the user's own contract page. The same GET also lazily
 * inserts a Notification row when the version is stale.
 */

const MENTOR = {
  endpoint: "/api/mentor-contract?summary=1",
  href: "/dashboard/contract",
  contractName: "Perjanjian Kemitraan Mentor",
  hidePath: "/dashboard/contract",
};

const MENTEE = {
  href: "/dashboard/mentee-contract",
  contractName: "Perjanjian Layanan Mentoring Mentee",
  hidePath: "/dashboard/mentee-contract",
};

export default function DashboardContractAlert({ role }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<ContractStateAPI | null>(null);

  const isMentor = role === "mentor";
  const isMentee = role === "mentee";
  const cfg = isMentor ? MENTOR : isMentee ? MENTEE : null;

  useEffect(() => {
    if (!cfg) return;
    // Skip while on the user's own contract page (banner hidden there anyway)
    // so we refresh exactly when they leave it after signing.
    if (pathname === cfg.hidePath) return;
    let cancelled = false;
    // Mentor: raw summary fetch. Mentee: shared prereq cache (deduped with
    // the hard gate that also mounts on every navigation).
    const load = isMentor
      ? fetch(MENTOR.endpoint, { credentials: "include", cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null,
        )
      : fetchMenteePrereqs();
    Promise.resolve(load)
      .then((d) => { if (!cancelled) setState((d as ContractStateAPI | null) ?? null); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [cfg, isMentor, pathname]);

  if (!cfg) return null;
  if (pathname === cfg.hidePath) return null;
  if (!state) return null;

  const status = state.contract?.status ?? null;
  const isSigned = status === "SIGNED";
  const identityFilled = state.identityCompleteness === state.identityRequired;

  let kind: "resign" | "void" | "unsigned" | null = null;
  if (state.needsResign) {
    kind = "resign";
  } else if (isMentor && status === "VOID") {
    kind = "void";
  } else if (isMentor && !isSigned) {
    kind = "unsigned";
  }
  // Mentee unsigned / void / no-deposit are all hard-gated, so the mentee
  // only ever surfaces the resign reminder here.

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
        body: `Mohon tanda tangan ulang ${cfg.contractName} sebelum melakukan aktivitas lainnya.`,
      };
    }
    return {
      title: `Anda belum menandatangani ${cfg.contractName}`,
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
          href={cfg.href}
          className="btn-primary inline-flex items-center justify-center whitespace-nowrap text-sm"
        >
          Buka Kontrak
        </Link>
      </div>
    </div>
  );
}
