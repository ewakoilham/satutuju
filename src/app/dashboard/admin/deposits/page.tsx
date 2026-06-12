"use client";

import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import DepositStatusBadge, {
  deriveDepositDisplayStatus,
} from "@/components/deposit/DepositStatusBadge";
import { formatJakartaDate } from "@/lib/datetime-id";
import { formatRupiah, type DepositDisplayStatus } from "@/lib/deposit-terms";
import AdminContractsSubNav from "@/components/contract/AdminContractsSubNav";

/**
 * Phase 19 — admin overview of mentee deposit status. Mirror of the
 * mentee contracts admin page; lists every mentee with their bukti
 * transfer state + kontrak context, links to the verification detail.
 */

type DepositStub = {
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  amount: number;
  proofUploadedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  rejectionCount: number;
  updatedAt: string | null;
};

type Row = {
  userId: string;
  name: string;
  email: string;
  deposit: DepositStub | null;
  contractStatus: "PENDING_SIGNATURE" | "SIGNED" | "VOID" | null;
};

type Filter = "all" | DepositDisplayStatus;

const CONTRACT_CHIP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  SIGNED: { label: "Kontrak ✓", variant: "success" },
  PENDING_SIGNATURE: { label: "Kontrak belum TTD", variant: "warning" },
  VOID: { label: "Kontrak batal", variant: "danger" },
};

export default function AdminDepositsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/admin/deposits", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows: Row[] }) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => deriveDepositDisplayStatus(r.deposit) === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: 0, NOT_STARTED: 0, UPLOADED: 0, VERIFIED: 0, REJECTED: 0 };
    (rows ?? []).forEach((r) => {
      c.all += 1;
      c[deriveDepositDisplayStatus(r.deposit)] += 1;
    });
    return c;
  }, [rows]);

  if (authLoading || rows === null) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (user && user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <AdminContractsSubNav active="deposits" />

      <header>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl font-extrabold text-foreground">
          Deposit Mentee
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Status pembayaran Deposit Komitmen {formatRupiah(1_000_000)} (Pasal 9)
          untuk seluruh mentee. Akses dashboard mentee terbuka begitu bukti
          diunggah — verifikasi di sini untuk mengkonfirmasi dana benar-benar
          diterima, atau tolak bukti yang tidak valid.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Semua ({counts.all})
        </FilterChip>
        <FilterChip active={filter === "NOT_STARTED"} onClick={() => setFilter("NOT_STARTED")}>
          Belum upload ({counts.NOT_STARTED})
        </FilterChip>
        <FilterChip active={filter === "UPLOADED"} onClick={() => setFilter("UPLOADED")}>
          Menunggu verifikasi ({counts.UPLOADED})
        </FilterChip>
        <FilterChip active={filter === "VERIFIED"} onClick={() => setFilter("VERIFIED")}>
          Terverifikasi ({counts.VERIFIED})
        </FilterChip>
        <FilterChip active={filter === "REJECTED"} onClick={() => setFilter("REJECTED")}>
          Ditolak ({counts.REJECTED})
        </FilterChip>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-text-muted-2 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Mentee</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Kontrak</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Tanggal Upload</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Ditolak</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted-2">
                  Tidak ada mentee pada filter ini.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = deriveDepositDisplayStatus(r.deposit);
              const contractChip = r.contractStatus
                ? CONTRACT_CHIP[r.contractStatus]
                : { label: "Kontrak belum mulai", variant: "neutral" as const };
              return (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/deposits/${r.userId}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-text-muted-2">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <DepositStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant={contractChip.variant}>{contractChip.label}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-text-muted">
                    {formatJakartaDate(r.deposit?.proofUploadedAt ?? null)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-text-muted">
                    {r.deposit && r.deposit.rejectionCount > 0
                      ? `${r.deposit.rejectionCount}× ditolak`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/admin/deposits/${r.userId}`}
                      className="text-primary hover:underline"
                    >
                      Lihat
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-surface-elevated border-border text-text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
