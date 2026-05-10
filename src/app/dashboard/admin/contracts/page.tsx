"use client";

import { useUser } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import ContractStatusBadge, {
  type ContractDisplayStatus,
} from "@/components/contract/ContractStatusBadge";

type ContractStub = {
  contractNumber: string;
  status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  signedAt: string | null;
  signatureHash: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  pdfPath: string | null;
};

type Row = {
  userId: string;
  name: string;
  email: string;
  contract: ContractStub | null;
  identityCompleteness: number;
  identityRequired: number;
};

type Filter = "all" | "signed" | "pending" | "void";

function deriveDisplayStatus(row: Row): ContractDisplayStatus {
  if (row.contract?.status === "SIGNED") return "SIGNED";
  if (row.contract?.status === "VOID") return "VOID";
  if (row.identityCompleteness === 0) return "NOT_STARTED";
  if (row.identityCompleteness < row.identityRequired) return "IDENTITY_INCOMPLETE";
  return "READY_TO_SIGN";
}

export default function AdminContractsPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/admin/contracts", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d: { rows: Row[] }) => setRows(d.rows ?? []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    return rows.filter((r) => {
      const s = deriveDisplayStatus(r);
      if (filter === "signed") return s === "SIGNED";
      if (filter === "void") return s === "VOID";
      return s === "NOT_STARTED" || s === "IDENTITY_INCOMPLETE" || s === "READY_TO_SIGN";
    });
  }, [rows, filter]);

  const counts = useMemo(() => {
    if (!rows) return { all: 0, signed: 0, pending: 0, void: 0 };
    let signed = 0,
      pending = 0,
      voided = 0;
    rows.forEach((r) => {
      const s = deriveDisplayStatus(r);
      if (s === "SIGNED") signed += 1;
      else if (s === "VOID") voided += 1;
      else pending += 1;
    });
    return { all: rows.length, signed, pending, void: voided };
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
      <header>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl font-extrabold text-foreground">
          Kontrak Mentor
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Status penandatanganan Perjanjian Kemitraan Mentor untuk seluruh mentor.
          Klik nama mentor untuk melihat detail kontrak, jejak audit, dan opsi pembatalan.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Semua ({counts.all})
        </FilterChip>
        <FilterChip active={filter === "signed"} onClick={() => setFilter("signed")}>
          Sudah ditandatangani ({counts.signed})
        </FilterChip>
        <FilterChip active={filter === "pending"} onClick={() => setFilter("pending")}>
          Belum ditandatangani ({counts.pending})
        </FilterChip>
        <FilterChip active={filter === "void"} onClick={() => setFilter("void")}>
          Dibatalkan ({counts.void})
        </FilterChip>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-background/60 text-text-muted-2 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Mentor</th>
              <th className="text-left px-4 py-3">Nomor Kontrak</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Data Identitas</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Ditandatangani</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted-2">
                  Tidak ada mentor pada filter ini.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const status = deriveDisplayStatus(r);
              return (
                <tr key={r.userId} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/contracts/${r.userId}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-text-muted-2">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.contract?.contractNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ContractStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-text-muted">
                    {r.identityCompleteness}/{r.identityRequired}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-text-muted">
                    {r.contract?.signedAt
                      ? new Date(r.contract.signedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/dashboard/admin/contracts/${r.userId}`}
                        className="text-primary hover:underline"
                      >
                        Lihat
                      </Link>
                      {status === "SIGNED" && (
                        <a
                          href={`/api/mentor-contract/pdf?userId=${r.userId}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-text-muted hover:text-primary"
                        >
                          <Icon name="download" size={12} />
                          PDF
                        </a>
                      )}
                    </div>
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
