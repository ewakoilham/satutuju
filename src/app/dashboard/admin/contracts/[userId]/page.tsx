"use client";

import { useUser } from "@/lib/hooks";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import ContractStatusBadge, {
  type ContractDisplayStatus,
} from "@/components/contract/ContractStatusBadge";
import type { IdentitySnapshot, PartialIdentity } from "@/lib/contract-template";
import { formatJakartaDateTime } from "@/lib/datetime-id";

interface FullContract {
  id: string;
  userId: string;
  contractNumber: string;
  status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  templateVersion: string;
  identitySnapshot: IdentitySnapshot | null;
  signatureDataUrl: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  pdfPath: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DetailResponse {
  user: { id: string; name: string; email: string; role: string };
  contract: FullContract | null;
  identity: PartialIdentity;
  identityCompleteness: number;
  identityRequired: number;
  currentVersion: string;
}

function deriveStatus(d: DetailResponse): ContractDisplayStatus {
  if (d.contract?.status === "SIGNED") return "SIGNED";
  if (d.contract?.status === "VOID") return "VOID";
  if (d.identityCompleteness === 0) return "NOT_STARTED";
  if (d.identityCompleteness < d.identityRequired) return "IDENTITY_INCOMPLETE";
  return "READY_TO_SIGN";
}

export default function AdminContractDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const targetUserId = params.userId;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!targetUserId) return;
    const res = await fetch(`/api/admin/contracts/${targetUserId}`, {
      credentials: "include",
    });
    if (!res.ok) {
      setError("Gagal memuat data");
      return;
    }
    const json = (await res.json()) as DetailResponse;
    setData(json);
  }, [targetUserId]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") router.push("/dashboard");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") reload();
  }, [authLoading, user, reload]);

  const onVoid = useCallback(async () => {
    setVoidBusy(true);
    try {
      const res = await fetch(`/api/admin/contracts/${targetUserId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", reason: voidReason }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error ?? "Gagal membatalkan");
      }
      setVoidOpen(false);
      setVoidReason("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membatalkan");
    } finally {
      setVoidBusy(false);
    }
  }, [targetUserId, voidReason, reload]);

  if (authLoading || !data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-72 w-full rounded-2xl" />
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    );
  }

  const status = deriveStatus(data);
  const c = data.contract;
  const identity =
    (c?.identitySnapshot as PartialIdentity | null) ?? data.identity;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/contracts"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-foreground"
      >
        ← Kembali ke daftar kontrak
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl font-extrabold text-foreground">
            {data.user.name}
          </h1>
          <ContractStatusBadge status={status} />
          {c?.status === "SIGNED" && c.templateVersion !== data.currentVersion && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning-light text-warning text-[11px] font-bold uppercase tracking-wide">
              Versi lama
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {data.user.email}
          {c?.contractNumber && (
            <> · Nomor kontrak: <span className="font-mono">{c.contractNumber}</span></>
          )}
        </p>
      </header>

      {c?.status === "SIGNED" && c.templateVersion !== data.currentVersion && (
        <div className="rounded-xl border border-warning/40 bg-warning-light/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-warning shrink-0">
              <Icon name="bell" size={14} />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Mentor menandatangani versi lama (v{c.templateVersion}). Versi
                aktif sekarang adalah v{data.currentVersion}.
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Mentor sudah dapat melihat banner peringatan + notifikasi dan
                dapat melakukan tanda tangan ulang melalui dashboard mereka.
                Tanda tangan lama tetap sah secara hukum untuk versi lama.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Audit + actions */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Jejak Audit</h2>
            <p className="text-xs text-text-muted-2">
              Identitas, IP, dan UA dibekukan saat penandatanganan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "SIGNED" && (
              <a
                href={`/api/mentor-contract/pdf?userId=${targetUserId}`}
                target="_blank"
                rel="noopener"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Icon name="download" size={14} />
                Unduh PDF
              </a>
            )}
            {status === "SIGNED" && (
              <button
                type="button"
                className="btn-ghost text-danger"
                onClick={() => setVoidOpen(true)}
              >
                Batalkan Kontrak
              </button>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Status" value={status} />
          <Field
            label="Versi Template"
            value={c?.templateVersion ?? "—"}
            mono
          />
          <Field
            label="Ditandatangani"
            value={formatJakartaDateTime(c?.signedAt ?? null)}
          />
          <Field
            label="Hash Tanda Tangan"
            value={c?.signatureHash ?? "—"}
            mono
          />
          <Field label="Alamat IP" value={c?.ipAddress ?? "—"} mono />
          <Field
            label="User Agent"
            value={c?.userAgent ?? "—"}
            mono
            collapse
          />
          {c?.voidedAt && (
            <>
              <Field
                label="Dibatalkan pada"
                value={formatJakartaDateTime(c.voidedAt)}
              />
              <Field label="Alasan Pembatalan" value={c.voidReason ?? "—"} />
            </>
          )}
        </dl>

        {c?.signatureDataUrl && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-text-muted-2 mb-2">
              Tanda Tangan Mentor
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.signatureDataUrl}
              alt="Tanda tangan mentor"
              className="h-24 rounded-md border border-border bg-white p-2"
            />
          </div>
        )}
      </section>

      {/* Identity snapshot */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          {c?.status === "SIGNED" ? "Data Identitas (saat penandatanganan)" : "Data Identitas (saat ini)"}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Nama Lengkap" value={identity.fullName ?? "—"} />
          <Field label="Tempat Lahir" value={identity.placeOfBirth ?? "—"} />
          <Field label="Tanggal Lahir" value={identity.dateOfBirth ?? "—"} />
          <Field
            label="Jenis Identitas"
            value={identity.idType ?? "—"}
          />
          <Field label="Nomor Identitas" value={identity.idNumber ?? "—"} mono />
          <Field label="NPWP" value={identity.npwp ?? "—"} mono />
          <Field label="Telepon" value={identity.phoneNumber ?? "—"} />
          <Field
            label="Alamat Resmi"
            value={identity.legalAddress ?? "—"}
            collapse
          />
        </dl>
      </section>

      {error && (
        <div className="rounded-lg bg-danger-light/60 border border-danger/40 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} size="md">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">
            Batalkan Kontrak
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Pembatalan akan menjadikan status kontrak <strong>VOID</strong>. Mentor
            akan diminta menandatangani ulang dengan nomor seri baru. PDF dan
            jejak audit dipertahankan untuk arsip.
          </p>
          <label className="block mt-4 text-xs font-medium text-text-muted-2 mb-1.5">
            Alasan pembatalan
          </label>
          <textarea
            className="form-input w-full"
            rows={3}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Mis. data identitas keliru, mentor minta perubahan, dsb."
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setVoidOpen(false)}
              disabled={voidBusy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={onVoid}
              disabled={voidBusy || voidReason.trim().length < 5}
            >
              {voidBusy ? "Membatalkan…" : "Konfirmasi Batalkan"}
            </button>
          </div>
        </div>
        <style jsx>{`
          .form-input {
            padding: 0.55rem 0.75rem;
            border: 1px solid var(--border);
            background: var(--surface);
            color: var(--foreground);
            border-radius: 0.5rem;
            font-size: 0.9rem;
            line-height: 1.4;
          }
          .form-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgb(57 88 179 / 0.18);
          }
        `}</style>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  collapse,
}: {
  label: string;
  value: string;
  mono?: boolean;
  collapse?: boolean;
}) {
  return (
    <div className={collapse ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-text-muted-2">{label}</dt>
      <dd className={`mt-0.5 text-foreground break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
