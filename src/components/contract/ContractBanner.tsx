import Link from "next/link";
import Icon from "@/components/ui/Icon";
import type { ContractDisplayStatus } from "./ContractStatusBadge";

interface ContractBannerProps {
  status: ContractDisplayStatus;
}

/**
 * Yellow callout shown at the top of the mentor's `/dashboard` whenever the
 * partnership contract isn't yet `SIGNED`. Hidden when status is SIGNED.
 *
 * Voided contracts also show the banner — they need to re-sign.
 */
export default function ContractBanner({ status }: ContractBannerProps) {
  if (status === "SIGNED") return null;

  const headline =
    status === "VOID"
      ? "Kontrak Anda dibatalkan dan perlu ditandatangani ulang"
      : "Anda belum menandatangani Perjanjian Kemitraan Mentor";

  const sub =
    status === "IDENTITY_INCOMPLETE"
      ? "Lengkapi data identitas Anda untuk melanjutkan ke proses tanda tangan."
      : status === "READY_TO_SIGN"
      ? "Data identitas Anda sudah lengkap — tinggal tanda tangan kontrak."
      : status === "VOID"
      ? "Silakan masuk ke halaman Kontrak untuk tanda tangan ulang."
      : "Klik tombol di samping untuk membaca dan menandatangani perjanjian.";

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-warning/40 bg-warning-light/60 px-4 py-3">
      <div className="flex items-start gap-3 flex-1">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning">
          <Icon name="bell" size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">{headline}</p>
          <p className="text-sm text-text-muted">{sub}</p>
        </div>
      </div>
      <Link
        href="/dashboard/contract"
        className="btn-primary inline-flex items-center justify-center whitespace-nowrap"
      >
        Buka Kontrak
      </Link>
    </div>
  );
}
