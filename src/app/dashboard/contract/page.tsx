"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useUser } from "@/lib/hooks";
import IdentityForm from "@/components/contract/IdentityForm";
import ContractPreview from "@/components/contract/ContractPreview";
import ContractTOC, {
  type ContractTocEntry,
} from "@/components/contract/ContractTOC";
import ContractTakeaways from "@/components/contract/ContractTakeaways";
import Field from "@/components/contract/Field";
import SignatureInput, {
  type SignatureInputHandle,
} from "@/components/contract/SignatureInput";
import ContractStatusBadge, {
  deriveContractDisplayStatus,
  type ContractDisplayStatus,
} from "@/components/contract/ContractStatusBadge";
import { useActiveAnchor } from "@/lib/use-active-anchor";
import type { PartialIdentity } from "@/lib/contract-template";
import {
  formatJakartaDateTime,
  formatJakartaLongDate,
} from "@/lib/datetime-id";

interface ContractRow {
  id: string;
  userId: string;
  contractNumber: string;
  status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  templateVersion: string;
  signedAt: string | null;
  signatureDataUrl: string | null;
  signatureHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  pdfPath: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

interface ChangelogEntry {
  version: string;
  date: string;
  summary: string;
  details?: string[];
}

interface ContractApiResponse {
  contract: ContractRow | null;
  identity: PartialIdentity;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  /** True when the signed contract's templateVersion lags the active version. */
  needsResign: boolean;
  /** Versions newer than what the mentor signed, newest-first. Empty if up-to-date. */
  changelogSinceSigned: ChangelogEntry[];
  previewHtml: string;
  previewToc: ContractTocEntry[];
}

export default function MentorContractPage() {
  const { user, loading } = useUser();
  const [data, setData] = useState<ContractApiResponse | null>(null);
  const [reloading, setReloading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [readChecked, setReadChecked] = useState(false);
  const [confirmAuthority, setConfirmAuthority] = useState(false);
  const [confirmNoConflict, setConfirmNoConflict] = useState(false);
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True when the user has clicked "Tanda Tangan Ulang" — switches the
   *  page from the signed-view back into the 3-step flow. Cleared after
   *  a successful re-sign (the next `reload()` will see status=SIGNED and
   *  matching templateVersion, so signed-view renders again). */
  const [resigning, setResigning] = useState(false);
  const sigRef = useRef<SignatureInputHandle>(null);
  // Callback ref for the contract reader's scroll container. Stored as
  // state (not a useRef) so the sibling <ContractTOC /> re-renders once
  // the element is attached and can wire up its IntersectionObserver
  // against the freshly-rendered heading nodes.
  const [previewScrollEl, setPreviewScrollEl] = useState<HTMLDivElement | null>(null);
  // Heading ids the preview contains, kept referentially stable so the
  // active-anchor IntersectionObserver doesn't remount each render.
  const headingIds = useMemo(
    () => data?.previewToc.map((e) => e.id) ?? [],
    [data?.previewToc],
  );
  const activeId = useActiveAnchor(previewScrollEl, headingIds);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      // cache: "no-store" — after a successful (re-)sign POST, browsers
      // may otherwise serve the prior GET response from disk cache and
      // hide the freshly bumped `signedAt` from the UI.
      const res = await fetch("/api/mentor-contract", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as ContractApiResponse;
      if (!res.ok) throw new Error("Gagal memuat data");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) reload();
  }, [loading, user, reload]);

  const status: ContractDisplayStatus = useMemo(
    () => (data ? deriveContractDisplayStatus(data) : "NOT_STARTED"),
    [data],
  );

  // While the mentor is in the resign flow, treat the page as not-signed
  // so the 3-step UI renders. The signed view comes back automatically
  // after the resubmit succeeds.
  const showSignedView = status === "SIGNED" && !resigning;
  const identityComplete =
    !!data && data.identityCompleteness === data.identityRequired;

  // ─── Submit ───────────────────────────────────────────────────────────
  const onSign = useCallback(async () => {
    if (!sigRef.current) return;
    const dataUrl = sigRef.current.getDataURL();
    if (!dataUrl) {
      setError("Tanda tangan belum digores");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mentor-contract", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureDataUrl: dataUrl,
          confirmations: {
            authority: confirmAuthority,
            noConflict: confirmNoConflict,
            accurate: confirmAccurate,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal menandatangani");
      // Successful (re-)sign: drop out of resign mode so SignedView
      // re-renders with the freshly returned data on the next reload.
      setResigning(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menandatangani");
    } finally {
      setSubmitting(false);
    }
  }, [confirmAuthority, confirmNoConflict, confirmAccurate, reload]);

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading || (!data && reloading)) {
    return (
      <div className="p-8">
        <SkeletonDashboard />
      </div>
    );
  }

  if (!user || user.role !== "mentor") {
    return (
      <div className="p-8">
        <p className="text-text-muted">Halaman ini hanya untuk mentor.</p>
      </div>
    );
  }

  // Fail-loud fallback: if the API returned an error or the response shape
  // is unexpected, surface it instead of silently rendering nothing.
  if (!data) {
    return (
      <div className="px-4 md:px-8 py-10 max-w-2xl mx-auto">
        <div className="rounded-xl border border-danger/40 bg-danger-light/40 p-5">
          <h2 className="font-semibold text-danger">
            Tidak dapat memuat data kontrak
          </h2>
          <p className="mt-1 text-sm text-foreground">
            {error ?? "Terjadi kesalahan saat menghubungi server."}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Penyebab paling umum: tabel <code>MentorContract</code> belum
            dibuat di database. Jalankan SQL di{" "}
            <code>prisma/sql/2026-05-10_mentor_contracts.sql</code> atau{" "}
            <code>npx prisma db push</code>, lalu muat ulang halaman ini.
          </p>
          <button
            type="button"
            className="mt-3 btn-ghost"
            onClick={reload}
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 max-w-4xl mx-auto">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted-2 mb-2">
          Perjanjian Kemitraan Mentor
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl md:text-4xl font-extrabold text-foreground">
            Kontrak Mentor
          </h1>
          <ContractStatusBadge status={status} />
        </div>
        {resigning ? (
          <div className="mt-3 rounded-lg border border-warning/40 bg-warning-light/60 px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">
              Tanda Tangan Ulang — Kontrak v{data.contractVersion}
            </p>
            <p className="mt-1 text-text-muted">
              Goreskan tanda tangan baru di bawah dan centang ketiga
              pernyataan untuk menandatangani versi terbaru. Tanda tangan
              lama Anda (untuk versi {data.contract?.templateVersion}) tetap
              tersimpan di arsip.
            </p>
          </div>
        ) : showSignedView && data.contract ? (
          <p className="mt-2 text-sm text-text-muted">
            Nomor kontrak: <span className="font-semibold">{data.contract.contractNumber}</span>
            {data.contract.signedAt && (
              <>
                {" "}· Ditandatangani {formatJakartaDateTime(data.contract.signedAt)}
              </>
            )}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            Lengkapi data identitas, baca seluruh kontrak, lalu tanda tangani secara digital.
            Tanda tangan elektronik ini sah berdasarkan UU No. 11 Tahun 2008 tentang Informasi
            dan Transaksi Elektronik.
          </p>
        )}
        {status === "VOID" && data.contract?.voidReason && (
          <div className="mt-4 rounded-lg border border-danger/40 bg-danger-light/60 px-4 py-3 text-sm">
            <p className="font-semibold text-danger">Kontrak ini dibatalkan oleh admin.</p>
            <p className="mt-1 text-foreground">Alasan: {data.contract.voidReason}</p>
            <p className="mt-1 text-text-muted">
              Anda dapat menandatangani ulang — kontrak baru akan menggunakan nomor seri berikutnya.
            </p>
          </div>
        )}
      </header>

      {/* SIGNED VIEW */}
      {showSignedView && data.contract && (
        <SignedView
          contract={data.contract}
          needsResign={data.needsResign}
          currentVersion={data.contractVersion}
          changelog={data.changelogSinceSigned}
          onResign={() => {
            setResigning(true);
            // Skip back to step 3 — identity is already on file from the
            // previous signing, and the contract body hasn't changed
            // substantively from the mentor's perspective beyond the
            // version label.
            setStep(3);
            setReadChecked(false);
            setScrolledToEnd(false);
            setConfirmAuthority(false);
            setConfirmNoConflict(false);
            setConfirmAccurate(false);
            setError(null);
          }}
          onRegenerated={reload}
        />
      )}

      {/* IN-PROGRESS FLOW */}
      {!showSignedView && (
        <>
          <Stepper
            current={step}
            identityComplete={identityComplete}
            scrolledToEnd={scrolledToEnd}
          />

          {step === 1 && (
            <Section
              title="Langkah 1 — Lengkapi Data Identitas"
              subtitle={`Diisi sesuai identitas resmi (${data.identityCompleteness}/${data.identityRequired} terisi).`}
            >
              <IdentityForm
                initial={data.identity}
                onSaved={() => {
                  reload();
                }}
              />
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={!identityComplete}
                  onClick={() => setStep(2)}
                >
                  Lanjut ke Langkah 2
                  <Icon name="check" size={14} />
                </button>
              </div>
              {!identityComplete && (
                <p className="mt-2 text-xs text-text-muted-2 text-right">
                  Lengkapi seluruh field di atas untuk melanjutkan.
                </p>
              )}
            </Section>
          )}

          {step === 2 && (
            <Section
              title="Langkah 2 — Baca Kontrak"
              subtitle="Gulir hingga akhir untuk membuka langkah berikutnya. Gunakan daftar isi di kiri untuk lompat antar bab; poin penting per pasal di kanan otomatis mengikuti bab yang sedang dibaca."
            >
              {/* Takeaway disclosure for narrow viewports (< lg) — sits
                  ABOVE the preview so mentor still gets the highlight
                  without the side rail. */}
              {/* Container queries make the reader adapt to its rendered
                  width regardless of viewport / Windows scaling. Outer
                  div is the query container; nested grid + sidebars use
                  `@[Npx]:` prefixes against IT, not the viewport.
                    - < 680px: single column, preview only
                    - ≥ 680px: 2-col (TOC + preview)
                    - ≥ 1024px: 3-col (TOC + preview + takeaways) */}
              <div className="@container lg:-mx-8 lg:px-2">
                <div className="grid gap-3 items-start @[680px]:grid-cols-[170px_minmax(0,1fr)] @[1024px]:grid-cols-[170px_minmax(0,1fr)_240px] @[1024px]:gap-4">
                  <aside className="hidden @[680px]:block">
                    <div className="sticky top-4 max-h-[60vh] overflow-y-auto pr-2">
                      <ContractTOC
                        entries={data.previewToc}
                        scrollContainer={previewScrollEl}
                        activeId={activeId}
                      />
                    </div>
                  </aside>
                  <ContractPreview
                    ref={setPreviewScrollEl}
                    html={data.previewHtml}
                    onScrolledToEnd={() => setScrolledToEnd(true)}
                    className="contract-prose max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-surface p-4 @[680px]:p-5 @[1024px]:p-6"
                  />
                  <aside className="hidden @[1024px]:block">
                    <div className="sticky top-4 max-h-[60vh] overflow-y-auto">
                      <ContractTakeaways
                        entries={data.previewToc}
                        activeId={activeId}
                        variant="sidebar"
                      />
                    </div>
                  </aside>
                </div>
              </div>
              <label className="mt-5 flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!scrolledToEnd}
                  checked={readChecked}
                  onChange={(e) => setReadChecked(e.target.checked)}
                />
                <span>
                  Saya telah membaca seluruh isi Perjanjian Kemitraan Mentor di atas.
                  {!scrolledToEnd && (
                    <span className="ml-2 text-xs text-text-muted-2">
                      (Gulir kontrak hingga akhir untuk mengaktifkan)
                    </span>
                  )}
                </span>
              </label>
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setStep(1)}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={!readChecked}
                  onClick={() => setStep(3)}
                >
                  Lanjut ke Tanda Tangan
                  <Icon name="check" size={14} />
                </button>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section
              title="Langkah 3 — Tanda Tangan Digital"
              subtitle="Tanda tangan ini, beserta jejak audit (waktu, IP, perangkat), akan disimpan sebagai bukti hukum."
            >
              <div className="mb-5">
                <SignatureInput
                  ref={sigRef}
                  disabled={submitting}
                  onEmptyChange={setSignatureEmpty}
                />
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <ConfirmRow
                  checked={confirmAuthority}
                  onChange={setConfirmAuthority}
                >
                  Saya memiliki kewenangan dan kapasitas hukum yang sah untuk menandatangani Perjanjian ini.
                </ConfirmRow>
                <ConfirmRow
                  checked={confirmNoConflict}
                  onChange={setConfirmNoConflict}
                >
                  Penandatanganan ini tidak melanggar perjanjian lain atau kewajiban yang saya miliki.
                </ConfirmRow>
                <ConfirmRow
                  checked={confirmAccurate}
                  onChange={setConfirmAccurate}
                >
                  Seluruh informasi yang saya berikan adalah benar, akurat, dan tidak menyesatkan.
                </ConfirmRow>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-danger-light/60 border border-danger/40 px-4 py-2 text-sm text-danger">
                  {error}
                </div>
              )}

              <div className="flex justify-between">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={submitting}
                  onClick={() => setStep(2)}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={
                    submitting ||
                    signatureEmpty ||
                    !confirmAuthority ||
                    !confirmNoConflict ||
                    !confirmAccurate
                  }
                  onClick={onSign}
                >
                  {submitting ? "Menandatangani…" : "Tanda Tangani Kontrak"}
                </button>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {subtitle && (
        <p className="mt-1 text-sm text-text-muted-2">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Stepper({
  current,
  identityComplete,
  scrolledToEnd,
}: {
  current: 1 | 2 | 3;
  identityComplete: boolean;
  scrolledToEnd: boolean;
}) {
  const steps = [
    { n: 1, label: "Data Identitas", done: identityComplete && current > 1 },
    { n: 2, label: "Baca Kontrak", done: scrolledToEnd && current > 2 },
    { n: 3, label: "Tanda Tangan", done: false },
  ];
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-3 text-sm">
      {steps.map((s, i) => {
        const active = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                s.done
                  ? "bg-success text-white"
                  : active
                  ? "bg-primary text-white"
                  : "bg-border text-text-muted-2"
              }`}
            >
              {s.done ? "✓" : s.n}
            </span>
            <span
              className={
                active ? "font-semibold text-foreground" : "text-text-muted"
              }
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="text-text-muted-2 mx-1">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ConfirmRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function SignedView({
  contract,
  needsResign,
  currentVersion,
  changelog,
  onResign,
  onRegenerated,
}: {
  contract: ContractRow;
  needsResign: boolean;
  currentVersion: string;
  changelog: ChangelogEntry[];
  onResign: () => void;
  onRegenerated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasPdf = !!contract.pdfPath;

  async function regenerate() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/mentor-contract/regenerate-pdf", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gagal regenerate PDF");
      onRegenerated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal regenerate PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {needsResign && (
        <div className="rounded-xl border border-warning/40 bg-warning-light/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-warning">
              <Icon name="bell" size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">
                Kontrak telah diperbarui ke versi {currentVersion}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Tanda tangan Anda yang sebelumnya (versi {contract.templateVersion})
                tetap sah dan tersimpan, namun Anda perlu menandatangani versi
                terbaru. Klik tombol "Tanda Tangan Ulang" di samping untuk melanjutkan.
              </p>

              {changelog.length > 0 && (
                <div className="mt-3 rounded-lg bg-surface border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted-2 mb-2">
                    Yang berubah sejak Anda terakhir tanda tangan
                  </p>
                  <ul className="space-y-3">
                    {changelog.map((entry) => (
                      <li key={entry.version} className="text-sm">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold text-foreground">
                            v{entry.version}
                          </span>
                          <span className="text-xs text-text-muted-2">
                            {formatJakartaLongDate(entry.date)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-foreground">{entry.summary}</p>
                        {entry.details && entry.details.length > 0 && (
                          <ul className="mt-1.5 ml-4 list-disc space-y-1 text-text-muted">
                            {entry.details.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-success/40 bg-success-light/40 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-success">
              Kontrak Tertandatangani
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Terima kasih — Anda resmi menjadi Mentor Satu Tuju.
            </p>
            {contract.signatureDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contract.signatureDataUrl}
                alt="Tanda tangan Anda"
                className="mt-4 h-20 rounded-md border border-border bg-white p-2"
              />
            )}
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-2 self-start">
            {hasPdf ? (
              <a
                href="/api/mentor-contract/pdf"
                target="_blank"
                rel="noopener"
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <Icon name="download" size={14} />
                Unduh PDF
              </a>
            ) : (
              <button
                type="button"
                className="btn-primary inline-flex items-center justify-center gap-2"
                disabled={busy}
                onClick={regenerate}
              >
                <Icon name="refresh" size={14} />
                {busy ? "Membuat PDF…" : "Generate PDF"}
              </button>
            )}

            {/* Re-sign trigger. Always rendered next to the download button
                so the affordance is discoverable, but only enabled when
                the system has detected an admin update. */}
            <button
              type="button"
              className={
                needsResign
                  ? "btn-ghost inline-flex items-center justify-center gap-2 border border-warning/50 text-warning"
                  : "btn-ghost inline-flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              }
              disabled={!needsResign}
              onClick={onResign}
              title={
                needsResign
                  ? "Kontrak telah diperbarui — klik untuk tanda tangan ulang"
                  : "Tidak ada pembaruan kontrak"
              }
            >
              <Icon name="edit" size={14} />
              Tanda Tangan Ulang
            </button>

            {!hasPdf && (
              <span className="text-xs text-text-muted-2 max-w-[14rem] text-right">
                PDF belum dibuat saat penandatanganan. Klik untuk membuatnya
                sekarang.
              </span>
            )}
            {!needsResign && (
              <span className="text-xs text-text-muted-2 max-w-[14rem] text-right">
                Tidak ada pembaruan dari admin.
              </span>
            )}
            {err && <span className="text-xs text-danger max-w-[14rem] text-right">{err}</span>}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Nomor Kontrak" value={contract.contractNumber} />
          <Field
            label="Versi Template"
            value={
              contract.templateVersion === currentVersion
                ? `${contract.templateVersion} (terbaru)`
                : `${contract.templateVersion} (versi lama)`
            }
            mono
          />
          <Field
            label="Ditandatangani pada"
            value={formatJakartaDateTime(contract.signedAt)}
          />
          <Field
            label="Hash Tanda Tangan"
            value={contract.signatureHash ?? "—"}
            mono
          />
          <Field label="Alamat IP" value={contract.ipAddress ?? "—"} mono />
        </dl>
      </section>

      {/* CTA → dedicated full-width reader at /dashboard/contract/salinan.
          Kept the link inline (not auto-redirect) so the audit panel
          above stays the canonical landing view post-sign. */}
      <Link
        href="/dashboard/contract/salinan"
        className="block rounded-2xl border border-border bg-surface-elevated hover:border-primary/40 hover:bg-primary-50/30 transition p-6 md:p-7"
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary flex-shrink-0">
            <Icon name="book" size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              Baca Salinan Perjanjian
            </h2>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
              Buka halaman pembacaan khusus — full-width dengan daftar isi,
              isi pasal, dan poin penting per pasal di sisi kanan. Dioptimasi
              untuk layar lebar.
            </p>
          </div>
          <Icon
            name="chevron-right"
            size={16}
            className="text-text-muted-2 mt-2 flex-shrink-0"
          />
        </div>
      </Link>
    </div>
  );
}

