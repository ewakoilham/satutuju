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
  /** Current logged-in user role; alert renders only for mentors. */
  role: string | undefined;
}

/**
 * Layout-level contract alert. Fetches the mentor's contract state once on
 * mount and renders a sticky-ish banner above every dashboard page when the
 * mentor still owes us a signature OR a re-signature. Hides itself on
 * `/dashboard/contract` (where the mentor is already addressing it) and for
 * non-mentor roles.
 *
 * The same `/api/mentor-contract` call also lazily inserts a Notification row
 * server-side when the version is stale, so the bell icon picks up the
 * heads-up regardless of which page the mentor lands on first.
 */
export default function DashboardContractAlert({ role }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<ContractStateAPI | null>(null);

  useEffect(() => {
    if (role !== "mentor") return;
    // Summary mode: skip the markdown → HTML → TOC pipeline server-side
    // since the alert only consumes status + needsResign.
    fetch("/api/mentor-contract?summary=1", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ContractStateAPI | null) => setState(d))
      .catch(() => null);
  }, [role]);

  // Don't double up on the contract page itself.
  if (pathname === "/dashboard/contract") return null;
  if (role !== "mentor") return null;
  if (!state) return null;

  const status = state.contract?.status ?? null;
  const isSigned = status === "SIGNED";
  const identityFilled = state.identityCompleteness === state.identityRequired;

  // Decide the messaging based on where the mentor is in the lifecycle.
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
            ? `Tanda tangan Anda di versi ${state.contract.templateVersion} masih sah, namun kontrak ini penting untuk segera ditandatangani versi terbarunya sebelum aktivitas mentoring dilanjutkan.`
            : "Mohon tanda tangani versi terbaru sebelum melanjutkan aktivitas.",
      };
    }
    if (kind === "void") {
      return {
        title: "Kontrak Anda dibatalkan oleh admin",
        body:
          "Mohon tanda tangan ulang Perjanjian Kemitraan Mentor sebelum melakukan aktivitas mentoring lainnya.",
      };
    }
    return {
      title: "Anda belum menandatangani Perjanjian Kemitraan Mentor",
      body: !identityFilled
        ? "Lengkapi data identitas Anda lalu tanda tangani kontrak. Kontrak ini wajib ditandatangani sebelum aktivitas mentoring dapat dilanjutkan."
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
          href="/dashboard/contract"
          className="btn-primary inline-flex items-center justify-center whitespace-nowrap text-sm"
        >
          Buka Kontrak
        </Link>
      </div>
    </div>
  );
}
