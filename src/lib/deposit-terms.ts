/**
 * Phase 19 — mentee deposit constants + agreement copy. Single source for
 * the deposit amount, the official SATU TUJU bank account, and the Pasal 9
 * consent texts shown on the upload page. Client-safe (no fs/process).
 *
 * All texts must stay consistent with the active mentee contract template
 * at `src/lib/contract-templates/perjanjian-mentee-2026-05.md` Pasal 9.
 */

export const DEPOSIT_AMOUNT_IDR = 1_000_000;
export const DEPOSIT_AMOUNT_LABEL = "Rp 1.000.000 (satu juta rupiah)";

/** Rekening resmi SATU TUJU untuk pembayaran deposit (Pasal 9.1 ayat 3). */
export const DEPOSIT_BANK = {
  bank: "Bank BCA",
  accountNumber: "5771 3525 03",
  accountNumberRaw: "5771352503", // for the clipboard copy button
  accountHolder: "Muhammad Ilham Razak",
} as const;

/** Stored on MenteeDeposit.status — no row means NOT_STARTED. */
export type DepositStatus = "UPLOADED" | "VERIFIED" | "REJECTED";
export type DepositDisplayStatus = "NOT_STARTED" | DepositStatus;

/** Stub of MenteeDeposit exposed to the banner/gate via the prereq summary. */
export type DepositSummary = {
  status: DepositStatus;
  amount: number;
  proofUploadedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
};

/**
 * The three consent checkboxes the mentee must tick before the upload
 * button enables. Frozen onto MenteeDeposit.confirmations at upload time.
 */
export const DEPOSIT_CONFIRMATION_KEYS = ["amount", "refund", "forfeit"] as const;
export type DepositConfirmationKey = (typeof DEPOSIT_CONFIRMATION_KEYS)[number];

export const DEPOSIT_CONFIRMATIONS: Record<DepositConfirmationKey, string> = {
  amount:
    "Saya memahami bahwa Deposit sebesar Rp 1.000.000 (satu juta rupiah) wajib dibayar 100% secara penuh melalui transfer ke rekening resmi SATU TUJU, dan merupakan dana komitmen — bukan biaya layanan (Pasal 9.1).",
  refund:
    "Saya memahami kondisi pengembalian Deposit 100%: mendaftar dan melakukan daftar ulang/enrollment di Universitas Mitra; ditolak seluruh Universitas Mitra yang dituju; visa ditolak setelah enrollment; atau Keadaan Kahar (Pasal 9.2).",
  forfeit:
    "Saya memahami kondisi Deposit hangus: tidak pernah mendaftar ke Universitas Mitra; diterima namun tidak enrollment; enrollment di universitas non-mitra; informasi palsu / dokumen tidak otentik; tidak kooperatif; pembatalan sepihak; atau terbukti melakukan pelecehan seksual (Pasal 9.3 dan 9.4).",
};

/** Bullet summaries of Pasal 9 for the deposit page's terms card. */
export const PASAL9_SUMMARY = {
  p91: [
    "Besaran Deposit ditetapkan sebesar Rp 1.000.000 (satu juta rupiah).",
    "Deposit wajib dibayar 100% secara penuh sebelum penandatanganan Perjanjian, sebagai bentuk komitmen atas pelaksanaan Layanan.",
    "Pembayaran dilakukan melalui transfer ke rekening resmi SATU TUJU.",
    "Deposit bukan biaya layanan, melainkan dana komitmen yang dapat dikembalikan sesuai ketentuan Pasal 9.",
  ],
  p92: [
    "Mendaftar/apply ke minimum 1 Universitas Mitra, dinyatakan diterima (LoA), dan melakukan daftar ulang/enrollment resmi.",
    "Mendaftar/apply ke Universitas Mitra namun ditolak oleh seluruh universitas tujuan (tidak memperoleh LoA).",
    "Visa pelajar ditolak setelah daftar ulang/enrollment — hak refund tetap berlaku.",
    "Keadaan Kahar (force majeure) yang berdampak material pada rencana studi.",
  ],
  p93: [
    "Tidak pernah mendaftar/apply ke Universitas Mitra mana pun selama Periode Mentoring.",
    "Diterima (LoA) di Universitas Mitra namun memilih tidak melakukan daftar ulang/enrollment.",
    "Melakukan daftar ulang/enrollment di universitas yang bukan Universitas Mitra.",
    "Memberikan informasi palsu atau dokumen tidak otentik.",
    "Tidak kooperatif — termasuk tidak responsif lebih dari 14 hari kalender berturut-turut, tidak menyerahkan dokumen tepat waktu, atau menolak prosedur Tim Admission.",
    "Membatalkan Perjanjian secara sepihak tanpa alasan yang sah.",
    "Terbukti melakukan pelecehan seksual (diatur khusus dalam Pasal 9.4 — Deposit diberikan seluruhnya sebagai kompensasi kepada korban).",
  ],
} as const;

const LABELS: Record<DepositDisplayStatus, string> = {
  NOT_STARTED: "Belum upload",
  UPLOADED: "Menunggu verifikasi",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
};

export function depositStatusLabel(status: DepositDisplayStatus): string {
  return LABELS[status];
}

export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}
