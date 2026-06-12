"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import {
  fetchMenteePrereqs,
  isDepositOk,
  type MenteePrereqState,
} from "@/lib/mentee-prereq-cache";

interface ContractStateAPI {
  contract: {
    status: string; // "PENDING_SIGNATURE" | "SIGNED" | "VOID"
    templateVersion: string;
  } | null;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  needsResign: boolean;
  /** Phase 19 — present for mentees only. */
  deposit?: MenteePrereqState["deposit"];
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
 * Phase 19 — mentee gains a `deposit` banner kind (contract kinds win):
 * shown when the contract is SIGNED but the Pasal 9 deposit proof hasn't
 * been uploaded, or when the proof was rejected by admin. The mentee fetch
 * goes through the shared prereq cache so the banner + MenteePrereqGate
 * mounted on the same navigation share one request.
 *
 * Hide rules are per-kind: contract kinds hide on the contract page,
 * the deposit kind hides on /dashboard/deposit. The same GET also lazily
 * inserts a Notification row server-side when the version is stale.
 */

type RoleConfig = {
  endpoint: string;
  href: string;
  contractName: string;       // shown in banner copy
  hidePath: string;           // route where contract banners shouldn't render
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

const DEPOSIT_PATH = "/dashboard/deposit";

export default function DashboardContractAlert({ role }: Props) {
  const pathname = usePathname();
  const [state, setState] = useState<ContractStateAPI | null>(null);
  const config = role ? ROLE_CONFIG[role] : undefined;

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    if (role === "mentee") {
      // Shared, deduped fetch (also feeds MenteePrereqGate). Always fetch —
      // visibility per banner kind is decided at render.
      fetchMenteePrereqs().then((d) => {
        if (!cancelled) setState(d);
      });
    } else {
      // Mentor path unchanged: skip while on the contract page (the banner
      // is hidden there anyway) so we refresh exactly when they leave it.
      if (pathname === config.hidePath) return;
      fetch(config.endpoint, { credentials: "include", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: ContractStateAPI | null) => { if (!cancelled) setState(d); })
        .catch(() => null);
    }
    return () => { cancelled = true; };
  }, [config, role, pathname]);

  if (!config) return null;
  if (!state) return null;

  const status = state.contract?.status ?? null;
  const isSigned = status === "SIGNED";
  const identityFilled = state.identityCompleteness === state.identityRequired;
  const depositMissing =
    role === "mentee" &&
    isSigned &&
    !isDepositOk(state as MenteePrereqState);

  let kind: "resign" | "void" | "unsigned" | "deposit" | null = null;
  if (state.needsResign) kind = "resign";
  else if (status === "VOID") kind = "void";
  else if (!isSigned) kind = "unsigned";
  else if (depositMissing) kind = "deposit";

  if (!kind) return null;

  // Per-kind hide paths: contract nags hide on the contract page, the
  // deposit nag hides on the deposit page.
  if (kind === "deposit" ? pathname === DEPOSIT_PATH : pathname === config.hidePath) {
    return null;
  }

  const depositRejected = kind === "deposit" && state.deposit?.status === "REJECTED";

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
    if (kind === "deposit") {
      if (depositRejected) {
        return {
          title: "Bukti deposit Anda ditolak",
          body: `${
            state.deposit?.rejectedReason
              ? `Alasan: ${state.deposit.rejectedReason}. `
              : ""
          }Mohon unggah ulang bukti transfer yang valid — akses Jadwal, Sesi, dan Dokumen ditangguhkan hingga bukti baru diunggah.`,
        };
      }
      return {
        title: "Anda belum membayar Deposit Komitmen",
        body: "Transfer deposit Rp 1.000.000 sesuai Pasal 9 perjanjian, lalu unggah bukti transfernya. Akses Jadwal, Sesi, dan Dokumen terbuka segera setelah bukti diunggah.",
      };
    }
    return {
      title: `Anda belum menandatangani ${config.contractName}`,
      body: !identityFilled
        ? "Lengkapi data identitas Anda lalu tanda tangani kontrak. Kontrak ini wajib ditandatangani sebelum aktivitas dilanjutkan."
        : "Data identitas Anda sudah lengkap — tinggal goreskan tanda tangan untuk menyelesaikan onboarding.",
    };
  })();

  const href = kind === "deposit" ? DEPOSIT_PATH : config.href;
  const cta = kind === "deposit" ? "Buka Deposit" : "Buka Kontrak";
  const tone = depositRejected
    ? {
        wrap: "border-b border-danger/40 bg-danger-light/70",
        chip: "bg-danger/20 text-danger",
      }
    : {
        wrap: "border-b border-warning/40 bg-warning-light/70",
        chip: "bg-warning/20 text-warning",
      };

  return (
    <div className={tone.wrap}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${tone.chip}`}>
          <Icon name={kind === "deposit" ? "wallet" : "bell"} size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-text-muted leading-relaxed">{body}</p>
        </div>
        <Link
          href={href}
          className="btn-primary inline-flex items-center justify-center whitespace-nowrap text-sm"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
