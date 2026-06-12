"use client";

import { useUser } from "@/lib/hooks";
import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/contract/Field";
import DepositStatusBadge, {
  deriveDepositDisplayStatus,
} from "@/components/deposit/DepositStatusBadge";
import {
  DEPOSIT_CONFIRMATIONS,
  DEPOSIT_CONFIRMATION_KEYS,
  formatRupiah,
} from "@/lib/deposit-terms";
import { formatJakartaDateTime } from "@/lib/datetime-id";

/**
 * Phase 19 — admin verification detail for one mentee's deposit proof.
 * Mirror of the mentee-contracts admin detail: audit fields + proof image
 * preview + verify/reject actions. Reject closes the mentee's hard gate
 * again and sends an alert notification with the reason.
 */

type HistoryEntry = {
  action: "upload" | "verify" | "reject";
  at: string;
  by: string;
  proofPath?: string;
  reason?: string;
};

interface FullDeposit {
  id: string;
  userId: string;
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  amount: number;
  proofPath: string | null;
  proofUploadedAt: string | null;
  confirmations: (Partial<Record<string, boolean>> & { confirmedAt?: string }) | null;
  transferNote: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  rejectionCount: number;
  history: HistoryEntry[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DetailResponse {
  user: { id: string; name: string; email: string; role: string };
  deposit: FullDeposit | null;
  contractStatus: "PENDING_SIGNATURE" | "SIGNED" | "VOID" | null;
}

const HISTORY_LABEL: Record<HistoryEntry["action"], string> = {
  upload: "Bukti diunggah",
  verify: "Diverifikasi admin",
  reject: "Ditolak admin",
};

export default function AdminDepositDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const targetUserId = params.userId;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!targetUserId) return;
    const res = await fetch(`/api/admin/deposits/${targetUserId}`, {
      credentials: "include",
      cache: "no-store",
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

  const doAction = useCallback(
    async (body: { action: "verify" } | { action: "reject"; reason: string }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/deposits/${targetUserId}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Aksi gagal");
        }
        setVerifyOpen(false);
        setRejectOpen(false);
        setRejectReason("");
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aksi gagal");
      } finally {
        setBusy(false);
      }
    },
    [targetUserId, reload],
  );

  if (authLoading || !data) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-72 w-full rounded-2xl" />
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    );
  }

  const d = data.deposit;
  const status = deriveDepositDisplayStatus(d);
  const confirmedKeys = d?.confirmations
    ? DEPOSIT_CONFIRMATION_KEYS.filter((k) => d.confirmations?.[k] === true)
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/deposits"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-foreground"
      >
        ← Kembali ke daftar deposit
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl font-extrabold text-foreground">
            {data.user.name}
          </h1>
          <DepositStatusBadge status={status} />
          {data.contractStatus !== "SIGNED" && (
            <Badge variant="warning">
              {data.contractStatus === "VOID" ? "Kontrak batal" : "Kontrak belum TTD"}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-text-muted">{data.user.email}</p>
      </header>

      {/* Bukti transfer */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bukti Transfer</h2>
            <p className="text-xs text-text-muted-2">
              Nominal yang diharapkan: {formatRupiah(d?.amount ?? 1_000_000)}.
              Cocokkan dengan mutasi rekening sebelum verifikasi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "UPLOADED" && (
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => setVerifyOpen(true)}
              >
                <Icon name="check" size={14} />
                Verifikasi
              </button>
            )}
            {(status === "UPLOADED" || status === "VERIFIED") && (
              <button
                type="button"
                className="btn-ghost text-danger"
                onClick={() => setRejectOpen(true)}
              >
                Tolak Bukti
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          {d?.proofPath ? (
            <a
              href={`/api/mentee-deposit/proof?userId=${targetUserId}`}
              target="_blank"
              rel="noopener"
              title="Buka ukuran penuh di tab baru"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/mentee-deposit/proof?userId=${targetUserId}`}
                alt="Bukti transfer deposit"
                className="max-h-96 rounded-md border border-border bg-white p-2 object-contain"
              />
            </a>
          ) : (
            <EmptyState
              icon="document"
              title="Belum ada bukti"
              description="Mentee belum mengunggah bukti transfer deposit."
            />
          )}
        </div>
      </section>

      {/* Detail + audit */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-foreground">Detail & Jejak Audit</h2>
        <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Status" value={status} />
          <Field label="Nominal" value={formatRupiah(d?.amount ?? 1_000_000)} />
          <Field
            label="Diunggah pada"
            value={formatJakartaDateTime(d?.proofUploadedAt ?? null)}
          />
          <Field label="Catatan transfer" value={d?.transferNote ?? "—"} />
          <Field
            label="Diverifikasi pada"
            value={formatJakartaDateTime(d?.verifiedAt ?? null)}
          />
          <Field label="Diverifikasi oleh" value={d?.verifiedBy ?? "—"} mono />
          {d?.rejectedAt && (
            <>
              <Field
                label="Ditolak pada"
                value={formatJakartaDateTime(d.rejectedAt)}
              />
              <Field label="Alasan penolakan" value={d.rejectedReason ?? "—"} />
            </>
          )}
          <Field
            label="Jumlah penolakan"
            value={String(d?.rejectionCount ?? 0)}
          />
          <Field label="Alamat IP" value={d?.ipAddress ?? "—"} mono />
          <Field label="User Agent" value={d?.userAgent ?? "—"} mono collapse />
        </dl>

        {confirmedKeys.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-text-muted-2 mb-2">
              Persetujuan Pasal 9 (dibekukan saat upload
              {d?.confirmations?.confirmedAt
                ? ` — ${formatJakartaDateTime(d.confirmations.confirmedAt)}`
                : ""}
              )
            </p>
            <ul className="space-y-2">
              {confirmedKeys.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Icon name="check" size={11} />
                  </span>
                  <span className="leading-relaxed">{DEPOSIT_CONFIRMATIONS[k]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Riwayat */}
      {(d?.history?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-border bg-surface-elevated p-6">
          <h2 className="text-base font-semibold text-foreground">Riwayat</h2>
          <ol className="mt-4 space-y-3">
            {[...(d?.history ?? [])].reverse().map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    h.action === "reject"
                      ? "bg-danger/15 text-danger"
                      : h.action === "verify"
                        ? "bg-success/15 text-success"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon
                    name={h.action === "reject" ? "x" : h.action === "verify" ? "check" : "upload"}
                    size={12}
                  />
                </span>
                <div>
                  <p className="font-medium text-foreground">{HISTORY_LABEL[h.action]}</p>
                  <p className="text-xs text-text-muted-2">
                    {formatJakartaDateTime(h.at)}
                    {h.reason && <> · {h.reason}</>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {error && (
        <div className="rounded-lg bg-danger-light/60 border border-danger/40 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <ConfirmModal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onConfirm={() => doAction({ action: "verify" })}
        title="Verifikasi pembayaran deposit"
        description="Pastikan dana benar-benar sudah masuk ke rekening SATU TUJU sebelum mengkonfirmasi. Mentee akan menerima notifikasi bahwa depositnya terverifikasi."
        confirmLabel={busy ? "Memproses…" : "Verifikasi"}
        loading={busy}
      />

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} size="md">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-foreground">Tolak Bukti Transfer</h2>
          <p className="mt-1 text-sm text-text-muted">
            Penolakan akan <strong>menutup kembali akses dashboard mentee</strong>{" "}
            (Jadwal, Sesi, Dokumen) dan mengirim notifikasi berisi alasan.
            Mentee dapat mengunggah ulang bukti yang valid.
          </p>
          <label className="block mt-4 text-xs font-medium text-text-muted-2 mb-1.5">
            Alasan penolakan
          </label>
          <textarea
            className="input-field w-full"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Mis. nominal tidak sesuai, bukti buram / tidak terbaca, transfer belum masuk, dsb."
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => doAction({ action: "reject", reason: rejectReason })}
              disabled={busy || rejectReason.trim().length < 5}
            >
              {busy ? "Memproses…" : "Konfirmasi Tolak"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
