"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { useUser } from "@/lib/hooks";
import DepositStatusBadge, {
  deriveDepositDisplayStatus,
} from "@/components/deposit/DepositStatusBadge";
import {
  DEPOSIT_AMOUNT_LABEL,
  DEPOSIT_BANK,
  DEPOSIT_CONFIRMATIONS,
  DEPOSIT_CONFIRMATION_KEYS,
  PASAL9_SUMMARY,
  formatRupiah,
  type DepositConfirmationKey,
} from "@/lib/deposit-terms";
import { invalidateMenteePrereqs } from "@/lib/mentee-prereq-cache";
import { formatJakartaDateTime } from "@/lib/datetime-id";

/**
 * Phase 19 — /dashboard/deposit. Mentee pays the Rp 1.000.000 commitment
 * deposit (Pasal 9) by bank transfer, agrees to the Pasal 9 terms, and
 * uploads the bukti transfer. Access to Jadwal/Sesi/Dokumen opens the
 * moment the proof is uploaded; admin verifies (or rejects) later.
 */

const MAX_SIZE = 5 * 1024 * 1024; // keep in sync with /api/mentee-deposit

interface DepositRow {
  id: string;
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  amount: number;
  proofPath: string | null;
  proofUploadedAt: string | null;
  transferNote: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  rejectionCount: number;
}

export default function DepositPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  const [deposit, setDeposit] = useState<DepositRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [confirms, setConfirms] = useState<Record<DepositConfirmationKey, boolean>>({
    amount: false,
    refund: false,
    forfeit: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transferNote, setTransferNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && user && user.role !== "mentee") router.push("/dashboard");
  }, [user, authLoading, router]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/mentee-deposit", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      setError("Gagal memuat data deposit");
      setLoaded(true);
      return;
    }
    const json = await res.json();
    setDeposit((json.deposit as DepositRow | null) ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === "mentee") reload();
  }, [authLoading, user, reload]);

  // Object-URL preview lifecycle
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPickFile = (f: File | null) => {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("Ukuran file maksimal 5 MB");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const allConfirmed = DEPOSIT_CONFIRMATION_KEYS.every((k) => confirms[k]);
  const canSubmit = allConfirmed && !!file && !submitting;

  const onSubmit = async () => {
    if (!canSubmit || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("confirmations", JSON.stringify(confirms));
      if (transferNote.trim()) fd.append("transferNote", transferNote.trim());
      const res = await fetch("/api/mentee-deposit", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error ?? "Gagal mengunggah bukti transfer");
      }
      setDeposit((json?.deposit as DepositRow | null) ?? null);
      setJustUploaded(true);
      setReplacing(false);
      setFile(null);
      setTransferNote("");
      setConfirms({ amount: false, refund: false, forfeit: false });
      if (fileInputRef.current) fileInputRef.current.value = "";
      invalidateMenteePrereqs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah bukti transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(DEPOSIT_BANK.accountNumberRaw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — user can select manually
    }
  };

  if (authLoading || !loaded) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const status = deriveDepositDisplayStatus(deposit);
  const showForm =
    status === "NOT_STARTED" || status === "REJECTED" || (status === "UPLOADED" && replacing);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl font-extrabold text-foreground">
            Deposit Komitmen
          </h1>
          <DepositStatusBadge status={status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Deposit {DEPOSIT_AMOUNT_LABEL} sesuai Pasal 9 Perjanjian Layanan
          Mentoring Mentee — dana komitmen yang dapat dikembalikan, bukan biaya
          layanan.
        </p>
      </header>

      {/* ── Status panels ── */}
      {status === "UPLOADED" && (
        <div className="rounded-xl border border-success/40 bg-success-light/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <Icon name="check" size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                {justUploaded
                  ? "Bukti transfer berhasil diunggah!"
                  : "Bukti transfer Anda sudah diterima"}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Akses Jadwal, Sesi, dan Dokumen Anda sudah terbuka — admin akan
                memverifikasi pembayaran Anda.
                {deposit?.proofUploadedAt && (
                  <> Diunggah {formatJakartaDateTime(deposit.proofUploadedAt)}.</>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/api/mentee-deposit/proof"
                  alt="Bukti transfer deposit"
                  className="h-28 rounded-md border border-border bg-white p-1 object-contain"
                />
                {!replacing && (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => setReplacing(true)}
                  >
                    Ganti Bukti
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {status === "VERIFIED" && (
        <div className="rounded-xl border border-success/40 bg-success-light/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
              <Icon name="check" size={14} />
            </span>
            <div>
              <p className="font-semibold text-foreground">Deposit Anda telah diverifikasi</p>
              <p className="mt-1 text-sm text-text-muted">
                Diverifikasi admin
                {deposit?.verifiedAt && <> pada {formatJakartaDateTime(deposit.verifiedAt)}</>}.
                Terima kasih!
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "REJECTED" && (
        <div className="rounded-xl border border-danger/40 bg-danger-light/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
              <Icon name="x" size={14} />
            </span>
            <div>
              <p className="font-semibold text-foreground">Bukti transfer Anda ditolak</p>
              <p className="mt-1 text-sm text-text-muted">
                {deposit?.rejectedReason
                  ? `Alasan: ${deposit.rejectedReason}.`
                  : "Bukti dinilai tidak valid."}{" "}
                Akses dashboard ditangguhkan — silakan unggah ulang bukti yang
                valid.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ketentuan Pasal 9 ── */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-foreground">
          Ketentuan Deposit (Pasal 9)
        </h2>
        <div className="mt-4 space-y-4 text-sm">
          <TermsBlock title="Pasal 9.1 — Besaran & Pembayaran" items={PASAL9_SUMMARY.p91} />
          <TermsBlock
            title="Pasal 9.2 — Dikembalikan 100% apabila"
            items={PASAL9_SUMMARY.p92}
          />
          <TermsBlock title="Pasal 9.3 — Hangus apabila" items={PASAL9_SUMMARY.p93} />
        </div>
        <Link
          href="/dashboard/mentee-contract"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Baca ketentuan lengkap di Perjanjian Layanan Mentoring Mentee →
        </Link>
      </section>

      {/* ── Rekening tujuan ── */}
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <h2 className="text-base font-semibold text-foreground">Rekening Resmi SATU TUJU</h2>
        <div className="mt-4 rounded-xl border border-border bg-surface px-5 py-4">
          <p className="text-sm font-medium text-text-muted">{DEPOSIT_BANK.bank}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="font-mono text-2xl font-bold tracking-wide text-foreground">
              {DEPOSIT_BANK.accountNumber}
            </p>
            <button
              type="button"
              onClick={copyAccount}
              className="btn-ghost inline-flex items-center gap-1.5 text-xs"
            >
              <Icon name={copied ? "check" : "copy"} size={13} />
              {copied ? "Tersalin ✓" : "Salin"}
            </button>
          </div>
          <p className="mt-1 text-sm text-text-muted">a.n. {DEPOSIT_BANK.accountHolder}</p>
          <p className="mt-3 text-sm text-foreground">
            Nominal transfer:{" "}
            <span className="font-bold">{formatRupiah(deposit?.amount ?? 1_000_000)}</span>
          </p>
        </div>
      </section>

      {/* ── Form persetujuan + upload ── */}
      {showForm && (
        <section className="rounded-2xl border border-border bg-surface-elevated p-6">
          <h2 className="text-base font-semibold text-foreground">
            {status === "REJECTED" || replacing ? "Unggah Ulang Bukti Transfer" : "Unggah Bukti Transfer"}
          </h2>
          <p className="mt-1 text-xs text-text-muted-2">
            Centang seluruh pernyataan persetujuan, lalu lampirkan tangkapan
            layar / foto bukti transfer (JPEG, PNG, atau WebP, maks. 5 MB).
          </p>

          <div className="mt-4 space-y-3">
            {DEPOSIT_CONFIRMATION_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  checked={confirms[key]}
                  onChange={(e) =>
                    setConfirms((c) => ({ ...c, [key]: e.target.checked }))
                  }
                />
                <span className="text-sm text-text-muted leading-relaxed">
                  {DEPOSIT_CONFIRMATIONS[key]}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5">
            <label className="block text-xs font-medium text-text-muted-2 mb-1.5">
              Bukti transfer (gambar)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Pratinjau bukti transfer"
                className="mt-3 max-h-64 rounded-md border border-border bg-white p-1 object-contain"
              />
            )}
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-text-muted-2 mb-1.5">
              Catatan transfer — opsional
            </label>
            <input
              type="text"
              className="input-field w-full"
              maxLength={500}
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Mis. nama pengirim / bank pengirim / tanggal transfer"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-light/60 border border-danger/40 px-4 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {replacing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setReplacing(false);
                  setFile(null);
                  setError(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={submitting}
              >
                Batal
              </button>
            )}
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              <Icon name="upload" size={14} />
              {submitting ? "Mengunggah…" : "Unggah Bukti Transfer"}
            </button>
          </div>
        </section>
      )}

      {!showForm && error && (
        <div className="rounded-lg bg-danger-light/60 border border-danger/40 px-4 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function TermsBlock({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-text-muted leading-relaxed">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
