"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useUser } from "@/lib/hooks";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import {
  fetchMenteePrereqs,
  isContractOk,
  isDepositOk,
  type MenteePrereqState,
} from "@/lib/mentee-prereq-cache";
import { DEPOSIT_AMOUNT_LABEL } from "@/lib/deposit-terms";

/**
 * Phase 19 — hard gate for every mentee dashboard surface (mounted at the
 * layout level around all page content; the contract + deposit pages are
 * exempt so a blocked mentee can still reach the escape hatches). Children
 * are NOT mounted while prerequisites are unmet, so the wrapped page's
 * effects/fetches never run for a blocked mentee.
 *
 * Pass-through for mentor/admin. Fail-open on network error — the data is
 * also enforced server-side per feature and the dashboard banner keeps
 * nagging, so a flaky connection never locks a paying mentee out.
 *
 * Stale-while-revalidate: because this now mounts on every navigation, we
 * keep showing the last-known prereq state while revalidating in the
 * background instead of blanking to a skeleton on each nav. The skeleton
 * only appears on the very first load.
 */
export default function MenteePrereqGate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const pathname = usePathname();
  // undefined = never loaded (skeleton); null = fetch failed (fail-open)
  const [state, setState] = useState<MenteePrereqState | null | undefined>(undefined);

  const isMentee = !authLoading && user?.role === "mentee";

  useEffect(() => {
    if (!isMentee) return;
    let cancelled = false;
    fetchMenteePrereqs().then((s) => {
      if (cancelled) return;
      // On success use the fresh state; on failure keep the last-known
      // state (or fail-open with null if we never had one).
      setState((prev) => s ?? prev ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [isMentee, pathname]);

  if (authLoading) return <SkeletonDashboard />;
  if (!user || user.role !== "mentee") return <>{children}</>;
  if (state === undefined) return <SkeletonDashboard />;
  if (state === null) return <>{children}</>;

  const contractOk = isContractOk(state);
  const depositOk = isDepositOk(state);
  if (contractOk && depositOk) return <>{children}</>;

  const rejectedReason =
    state.deposit?.status === "REJECTED" ? state.deposit.rejectedReason : null;

  return (
    <div className="animate-fade-in py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface-elevated p-8 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Icon name="lock" size={26} />
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-extrabold text-foreground">
          Selesaikan Persyaratan Terlebih Dahulu
        </h1>
        <p className="mt-2 text-sm text-text-muted leading-relaxed">
          Halaman ini terkunci sampai Anda menandatangani kontrak dan
          mengunggah bukti pembayaran deposit.
        </p>

        <div className="mt-6 space-y-3 text-left">
          <PrereqRow
            done={contractOk}
            label="Tanda tangani Perjanjian Layanan Mentoring Mentee"
            href="/dashboard/mentee-contract"
            cta="Buka Kontrak"
          />
          <PrereqRow
            done={depositOk}
            label={`Bayar & unggah bukti Deposit ${DEPOSIT_AMOUNT_LABEL}`}
            href="/dashboard/deposit"
            cta="Buka Deposit"
            detail={
              rejectedReason
                ? `Bukti sebelumnya ditolak: ${rejectedReason}`
                : undefined
            }
          />
        </div>

        <p className="mt-6 text-xs text-text-muted-2 leading-relaxed">
          Akses terbuka segera setelah bukti transfer diunggah, tanpa menunggu
          verifikasi admin.
        </p>
      </div>
    </div>
  );
}

function PrereqRow({
  done,
  label,
  href,
  cta,
  detail,
}: {
  done: boolean;
  label: string;
  href: string;
  cta: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-success/15 text-success" : "bg-border/60 text-text-muted-2"
        }`}
      >
        <Icon name={done ? "check" : "x"} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-danger leading-snug">{detail}</p>}
      </div>
      {done ? (
        <span className="shrink-0 text-xs font-semibold text-success">Selesai</span>
      ) : (
        <Link href={href} className="btn-primary shrink-0 whitespace-nowrap text-xs">
          {cta}
        </Link>
      )}
    </div>
  );
}
