/**
 * Phase 18 — mentee contract template metadata, identity-field schema, and
 * in-place interpolation. Parallel to `src/lib/contract-template.ts` for
 * the mentor side; deliberately separate so the two contracts evolve
 * independently (different identity shape, different changelog, different
 * version cadence).
 *
 * Client-safe: no `fs`, no `process.cwd()`. The disk read of the markdown
 * source lives in `mentee-contract-template-server.ts`.
 */

import {
  formatDateID,
  formatSigningDateID,
} from "@/lib/contract-template";

/** Pinned at sign time so future template edits don't mutate signed records. */
export const MENTEE_CONTRACT_VERSION = "2026.05.31";

/** Lifecycle states stored on `MenteeContract.status` — same shape as mentor. */
export type MenteeContractStatus = "PENDING_SIGNATURE" | "SIGNED" | "VOID";

/**
 * True when a SIGNED mentee contract is on a template version older than
 * the currently active one — the mentee needs to re-sign.
 */
export function isMenteeContractStale(
  contract: { status: string; templateVersion: string } | null | undefined,
  currentVersion: string,
): boolean {
  return (
    !!contract &&
    contract.status === "SIGNED" &&
    contract.templateVersion !== currentVersion
  );
}

/**
 * Changelog of mentee contract template versions, oldest first. Same
 * convention as the mentor changelog: prepend a new entry every time
 * `MENTEE_CONTRACT_VERSION` is bumped so the resign banner can show
 * mentees exactly what changed since they signed.
 */
export type MenteeContractChangelogEntry = {
  version: string; // matches MENTEE_CONTRACT_VERSION format
  date: string;    // ISO date the version went live
  summary: string;
  details?: string[];
};

export const MENTEE_CONTRACT_CHANGELOG: MenteeContractChangelogEntry[] = [
  {
    version: "2026.05.30",
    date: "2026-05-30",
    summary: "Versi awal Perjanjian Layanan Mentoring Mentee Satu Tuju.",
  },
  {
    version: "2026.05.31",
    date: "2026-05-31",
    summary:
      "Generalisasi ruang lingkup: kontrak tidak lagi terbatas pada jenjang S2 / pascasarjana, dan tidak menyebut brand beasiswa tertentu.",
    details: [
      "Pasal 1.1 — frasa \"calon mahasiswa pascasarjana (S2) Indonesia\" diubah menjadi \"calon mahasiswa Indonesia\"; daftar brand beasiswa (LPDP, Chevening, Australia Awards, Fulbright) dihapus dari contoh jalur beasiswa.",
      "Pasal 1.4 — frasa \"melanjutkan studi pascasarjana (S2) ke luar negeri\" disederhanakan menjadi \"melanjutkan studi ke luar negeri\".",
      "Pasal 2.2 — definisi Mentor diubah dari \"alumni program magister (S2)\" menjadi \"alumni program studi\" di luar negeri.",
      "Pasal 13.1 ayat (5) — referensi \"program studi pascasarjana\" diganti menjadi \"program studi MENTEE\".",
      "Pasal 13.1 ayat (6) — daftar brand beasiswa (LPDP, Chevening, Australia Awards, Fulbright) dihapus.",
      "Tidak ada perubahan substantif pada hak, kewajiban, mekanisme deposit, atau klausul lain.",
    ],
  },
  // ── Tambahkan entri baru di SINI saat menaikkan MENTEE_CONTRACT_VERSION ──
];

/**
 * Compute the changelog entries strictly newer than `signedVersion` and
 * ≤ `currentVersion`. Used by the resign banner to show "Yang berubah
 * sejak Anda terakhir tanda tangan".
 */
export function changelogSinceMentee(
  signedVersion: string,
  currentVersion: string,
): MenteeContractChangelogEntry[] {
  return MENTEE_CONTRACT_CHANGELOG.filter(
    (e) => e.version > signedVersion && e.version <= currentVersion,
  ).reverse();
}

// ─── Identity schema ──────────────────────────────────────────────────────

/**
 * Identity fields needed by the mentee contract template. 7 fields
 * (no NPWP, vs mentor's 8). Email is derived from User.email and isn't
 * stored on MenteeProfile so it's intentionally not in this list.
 */
export const MENTEE_IDENTITY_FIELDS = [
  "fullName",
  "placeOfBirth",
  "dateOfBirth",
  "idType",
  "idNumber",
  "legalAddress",
  "phoneNumber",
] as const;

export type MenteeIdentityField = (typeof MENTEE_IDENTITY_FIELDS)[number];

export type MenteeIdentitySnapshot = {
  fullName: string;
  placeOfBirth: string;
  dateOfBirth: string; // "YYYY-MM-DD"
  idType: string;      // "KTP" | "Paspor"
  idNumber: string;
  legalAddress: string;
  phoneNumber: string;
};

export type PartialMenteeIdentity = Partial<MenteeIdentitySnapshot>;

/** True when every MENTEE_IDENTITY_FIELDS slot has a non-empty trimmed string. */
export function isMenteeIdentityComplete(
  input: PartialMenteeIdentity,
): input is MenteeIdentitySnapshot {
  return MENTEE_IDENTITY_FIELDS.every((k) => {
    const v = input[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Count of filled fields — used for "X/7 lengkap" progress. */
export function menteeIdentityCompleteness(input: PartialMenteeIdentity): number {
  return MENTEE_IDENTITY_FIELDS.reduce((n, k) => {
    const v = input[k];
    return n + (typeof v === "string" && v.trim().length > 0 ? 1 : 0);
  }, 0);
}

// ─── Interpolation ────────────────────────────────────────────────────────

/**
 * Snapshot + signing context the interpolator needs. We pull email off
 * the User row at sign time and bundle it in here — it's part of the
 * mentee preamble even though it's not stored in MenteeProfile.
 */
export type MenteeInterpolationContext = {
  identity: MenteeIdentitySnapshot;
  email: string;
  contractNumber: string;
  signedAt: Date;
};

/**
 * Replace template placeholders in the mentee contract body with real
 * mentee data. Mirrors the mentor interpolator but targets the
 * mentee-specific placeholders:
 *
 * - `____/ST-MTE/____/20__` → contract number
 * - `pada hari ______, tanggal ___ bulan _______ tahun ____ (__-__-20__)` → signing date
 * - `[Nama Lengkap Mentee]` (multiple occurrences)
 * - `lahir di [tempat], pada tanggal [tgl/bln/thn]` → place + DOB
 * - `pemegang [Kartu Tanda Penduduk (KTP) / Paspor] Nomor ________________`
 * - `beralamat di ________________`
 * - `alamat *email* ________________` → email
 * - `nomor telepon ________________` → phone number
 */
export function interpolateMenteeContract(
  body: string,
  ctx: MenteeInterpolationContext,
): string {
  const { identity, email, contractNumber, signedAt } = ctx;
  const idLabel =
    identity.idType === "Paspor"
      ? "Paspor"
      : "Kartu Tanda Penduduk (KTP)";

  return body
    // Contract number — header.
    .replace(/____\/ST-MTE\/____\/20__/g, contractNumber)
    // Signing date phrase in the comparisi block.
    .replace(
      /pada hari ______, tanggal ___ bulan _______ tahun ____ \(__-__-20__\)/g,
      `pada ${formatSigningDateID(signedAt)}`,
    )
    // Mentee name — appears in the comparisi and in the signing block.
    .replace(/\[Nama Lengkap Mentee\]/g, identity.fullName)
    // Place + date of birth.
    .replace(
      /lahir di \[tempat\], pada tanggal \[tgl\/bln\/thn\]/g,
      `lahir di ${identity.placeOfBirth}, pada tanggal ${formatDateID(identity.dateOfBirth)}`,
    )
    // ID type + number — comparisi line.
    .replace(
      /pemegang \[Kartu Tanda Penduduk \(KTP\) \/ Paspor\] Nomor ________________/g,
      `pemegang ${idLabel} Nomor ${identity.idNumber}`,
    )
    // Address.
    .replace(/beralamat di ________________/g, `beralamat di ${identity.legalAddress}`)
    // Email (appears once in preamble, e.g. "alamat *email* ________________").
    .replace(/alamat \*email\* ________________/g, `alamat *email* ${email}`)
    // Phone number (appears once in preamble, e.g. "nomor telepon ________________").
    .replace(/nomor telepon ________________/g, `nomor telepon ${identity.phoneNumber}`);
}

// ─── Hashing ──────────────────────────────────────────────────────────────

/**
 * SHA-256 hex over (templateVersion + identitySnapshot + signatureDataUrl).
 * Mirrors `computeSignatureHash` for the mentor; kept as a separate
 * function so the parameter shape is type-safe against the mentee
 * snapshot.
 */
export async function computeMenteeSignatureHash(
  templateVersion: string,
  identity: MenteeIdentitySnapshot,
  signatureDataUrl: string,
): Promise<string> {
  const payload = `${templateVersion}${JSON.stringify(identity)}${signatureDataUrl}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
