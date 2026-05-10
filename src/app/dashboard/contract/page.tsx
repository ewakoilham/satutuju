"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useUser } from "@/lib/hooks";
import IdentityForm from "@/components/contract/IdentityForm";
import ContractPreview from "@/components/contract/ContractPreview";
import SignatureCanvas, {
  type SignatureCanvasHandle,
} from "@/components/contract/SignatureCanvas";
import ContractStatusBadge, {
  type ContractDisplayStatus,
} from "@/components/contract/ContractStatusBadge";
import type { PartialIdentity } from "@/lib/contract-template";

interface ContractRow {
  id: string;
  userId: string;
  contractNumber: string;
  status: "PENDING_SIGNATURE" | "SIGNED" | "VOID";
  signedAt: string | null;
  signatureDataUrl: string | null;
  signatureHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  pdfPath: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

interface ContractApiResponse {
  contract: ContractRow | null;
  identity: PartialIdentity;
  identityCompleteness: number;
  identityRequired: number;
  contractVersion: string;
  previewHtml: string;
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
  const sigRef = useRef<SignatureCanvasHandle>(null);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const res = await fetch("/api/mentor-contract", { credentials: "include" });
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

  const status: ContractDisplayStatus = useMemo(() => {
    if (!data) return "NOT_STARTED";
    if (data.contract?.status === "SIGNED") return "SIGNED";
    if (data.contract?.status === "VOID") return "VOID";
    if (data.identityCompleteness === 0) return "NOT_STARTED";
    if (data.identityCompleteness < data.identityRequired) return "IDENTITY_INCOMPLETE";
    return "READY_TO_SIGN";
  }, [data]);

  const isSigned = status === "SIGNED";
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

  if (!data) return null;

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
        {isSigned && data.contract ? (
          <p className="mt-2 text-sm text-text-muted">
            Nomor kontrak: <span className="font-semibold">{data.contract.contractNumber}</span>
            {data.contract.signedAt && (
              <>
                {" "}· Ditandatangani{" "}
                {new Date(data.contract.signedAt).toLocaleString("id-ID", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
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
      {isSigned && data.contract && (
        <SignedView contract={data.contract} previewHtml={data.previewHtml} />
      )}

      {/* IN-PROGRESS FLOW */}
      {!isSigned && (
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
              subtitle="Gulir hingga akhir untuk membuka langkah berikutnya."
            >
              <ContractPreview
                html={data.previewHtml}
                onScrolledToEnd={() => setScrolledToEnd(true)}
              />
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
                <SignatureCanvas
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
  previewHtml,
}: {
  contract: ContractRow;
  previewHtml: string;
}) {
  return (
    <div className="space-y-6">
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
          <a
            href="/api/mentor-contract/pdf"
            target="_blank"
            rel="noopener"
            className="btn-primary inline-flex items-center gap-2 self-start"
          >
            <Icon name="download" size={14} />
            Unduh PDF
          </a>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="Nomor Kontrak" value={contract.contractNumber} />
          <Field
            label="Ditandatangani pada"
            value={
              contract.signedAt
                ? new Date(contract.signedAt).toLocaleString("id-ID", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
          <Field
            label="Hash Tanda Tangan"
            value={contract.signatureHash ?? "—"}
            mono
          />
          <Field label="Alamat IP" value={contract.ipAddress ?? "—"} mono />
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-6 md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Salinan Perjanjian
        </h2>
        <div
          className="contract-prose"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted-2">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-foreground break-all ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
