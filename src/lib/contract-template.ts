/**
 * Contract template metadata, identity-field schema, and the in-place
 * interpolation logic for the Perjanjian Kemitraan Mentor.
 *
 * The contract body itself lives as Markdown at
 * `src/lib/contract-templates/perjanjian-mentor-2026-05.md`.
 * `getContractBody()` reads it from disk on the server (Next.js inlines the
 * file at build time via `fs.readFileSync` in a server-only module) and
 * returns the raw string. Browser callers should NOT import this directly —
 * they should fetch the rendered preview from the API or receive
 * server-rendered HTML.
 */

// `server-only` directive removed so this module can be imported by both
// Next.js server components / route handlers AND by one-off node scripts
// in prisma/scripts/. Server-only nature is enforced de facto by the
// `fs` import below — it would fail in any browser bundle anyway.
import { promises as fs } from "fs";
import path from "path";
import { formatSigningDatePhrase } from "@/lib/datetime-id";

/** Pinned at sign time so future template edits don't mutate signed records. */
export const CONTRACT_VERSION = "2026.05.12";

/**
 * Changelog of contract template versions, oldest first. Each time
 * `CONTRACT_VERSION` is bumped, prepend an entry here describing what
 * changed for the mentor's benefit. Mentors who signed at an older
 * version see all entries strictly newer than theirs in the resign
 * banner — so they know exactly what they're agreeing to.
 *
 * `summary` is a short one-line headline; `details` is an optional
 * bulleted list with more specifics.
 */
export type ContractChangelogEntry = {
  version: string; // matches CONTRACT_VERSION format, e.g. "2026.05.10"
  date: string;    // ISO date the version went live
  summary: string;
  details?: string[];
};

export const CONTRACT_CHANGELOG: ContractChangelogEntry[] = [
  {
    version: "2026.05.10",
    date: "2026-05-10",
    summary: "Versi awal Perjanjian Kemitraan Mentor Satu Tuju.",
  },
  {
    version: "2026.05.11",
    date: "2026-05-11",
    summary:
      "Tanda tangan elektronik PIHAK PERTAMA (Direktur Utama) ditambahkan ke PDF kontrak.",
    details: [
      "Sebelumnya kolom PIHAK PERTAMA hanya berisi garis tanda tangan kosong.",
      "Sesuai Pasal 13.10 ayat (4), kontrak baru fully effective ketika kedua pihak telah menandatangani — penambahan tanda tangan Razak sebagai Direktur Utama membuat status hukum kontrak menjadi tertanda tangan dari kedua pihak.",
      "Tidak ada perubahan substantif lain pada isi Pasal 1 sampai Pasal 13.",
    ],
  },
  {
    version: "2026.05.12",
    date: "2026-05-12",
    summary:
      "Penambahan Pasal 6 — Kebijakan Anti-Pelecehan Seksual dan Perlindungan Martabat.",
    details: [
      "Pasal 6 baru menetapkan kebijakan zero-tolerance terhadap pelecehan seksual, definisi pelecehan (verbal/non-verbal/fisik/digital/penyalahgunaan kuasa), larangan khusus dalam konteks mentoring (mis. larangan menginisiasi hubungan romantis dengan Mentee), mekanisme pelaporan (kanal report@satutuju.id, bisa anonim, tanpa kedaluwarsa), tindakan SATU TUJU kepada korban (perlindungan kerahasiaan, anti-retaliasi, pemisahan segera, fasilitasi rujukan), dan konsekuensi kepada pelaku (Strike 3 langsung untuk MENTOR, larangan permanen, ganti rugi).",
      "Sebagai konsekuensi penambahan Pasal 6 baru, seluruh Pasal yang sebelumnya bernomor 6–13 dinaikkan satu angka menjadi Pasal 7–14. Cross-reference internal dalam dokumen turut disesuaikan.",
      "Selaras dengan UU No. 12 Tahun 2022 tentang Tindak Pidana Kekerasan Seksual (UU TPKS).",
    ],
  },
  // ── Tambahkan entri baru di SINI saat menaikkan CONTRACT_VERSION ──
  // Contoh:
  // {
  //   version: "2026.06.01",
  //   date:    "2026-06-01",
  //   summary: "Penyesuaian skema Success Fee per Universitas Mitra.",
  //   details: [
  //     "Pasal 7.2: tarif Success Fee untuk Australia naik dari X ke Y.",
  //     "Lampiran B: tambahan 3 kampus baru di UK.",
  //   ],
  // },
];

/**
 * Compute the entries strictly newer than `signedVersion` and ≤ `currentVersion`.
 * Used by the resign banner to show "Yang berubah sejak Anda terakhir tanda
 * tangan". Returns newest-first for top-down reading.
 */
export function changelogSince(
  signedVersion: string,
  currentVersion: string,
): ContractChangelogEntry[] {
  return CONTRACT_CHANGELOG.filter(
    (e) => e.version > signedVersion && e.version <= currentVersion,
  ).reverse();
}

const TEMPLATE_FILE = path.join(
  process.cwd(),
  "src",
  "lib",
  "contract-templates",
  "perjanjian-mentor-2026-05.md",
);

let cachedBody: string | null = null;

export async function getContractBody(): Promise<string> {
  // Cache only in production — in dev we want template edits to show
  // up on the next request without a server restart.
  if (cachedBody && process.env.NODE_ENV === "production") return cachedBody;
  cachedBody = await fs.readFile(TEMPLATE_FILE, "utf8");
  return cachedBody;
}

// ─── Identity schema ──────────────────────────────────────────────────────

/** The identity fields the contract template needs interpolated. */
export const IDENTITY_FIELDS = [
  "fullName",
  "placeOfBirth",
  "dateOfBirth",
  "idType",
  "idNumber",
  "npwp",
  "legalAddress",
  "phoneNumber",
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export type IdentitySnapshot = {
  fullName: string;
  placeOfBirth: string;
  dateOfBirth: string; // "YYYY-MM-DD"
  idType: string; // "KTP" | "Paspor"
  idNumber: string;
  npwp: string;
  legalAddress: string;
  phoneNumber: string;
};

export type PartialIdentity = Partial<IdentitySnapshot>;

/** True when every IDENTITY_FIELDS slot has a non-empty trimmed string. */
export function isIdentityComplete(input: PartialIdentity): input is IdentitySnapshot {
  return IDENTITY_FIELDS.every((k) => {
    const v = input[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Count of filled fields — used to show "5/7 lengkap" progress. */
export function identityCompleteness(input: PartialIdentity): number {
  return IDENTITY_FIELDS.reduce((n, k) => {
    const v = input[k];
    return n + (typeof v === "string" && v.trim().length > 0 ? 1 : 0);
  }, 0);
}

// ─── Date helpers ─────────────────────────────────────────────────────────
// Date-of-birth is stored as a literal "YYYY-MM-DD" string and has no
// timezone semantics — formatDateID just splits and reformats. Any
// real-clock timestamp (signing date, audit times) goes through the
// Jakarta-aware helpers in `@/lib/datetime-id` so the rendered contract
// reads the same regardless of where it's served from.

const ID_MONTH = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Format an ISO date ("YYYY-MM-DD") as Indonesian "12 Mei 2026". */
export function formatDateID(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${ID_MONTH[m - 1]} ${y}`;
}

// Old export name preserved for callers that import from this module —
// resolves the signing date in Asia/Jakarta regardless of host timezone.
export const formatSigningDateID = formatSigningDatePhrase;

// ─── Table of contents ────────────────────────────────────────────────────

export type ContractTocEntry = {
  /** Slug used as the heading's `id` attribute and the anchor target. */
  id: string;
  /** Plain-text label shown in the TOC. */
  text: string;
  /** Heading level (1–4). */
  depth: number;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Walk the rendered contract HTML, inject `id` attributes on every heading
 * (h1–h4), and return a parallel list of TOC entries. Headings with
 * duplicate slugs get a numeric suffix so anchors stay unique.
 *
 * The "PASAL N" pattern in the template renders as two consecutive h2s
 * ("## PASAL 1" then "## LATAR BELAKANG"). We collapse those into a single
 * TOC entry "Pasal 1 — Latar Belakang" so navigation stays compact, while
 * still anchoring to the first h2 (PASAL N) for accurate scroll target.
 */
export function buildContractToc(html: string): {
  html: string;
  toc: ContractTocEntry[];
} {
  const used = new Set<string>();
  const raw: ContractTocEntry[] = [];

  const newHtml = html.replace(
    /<h([1-4])>([\s\S]*?)<\/h\1>/g,
    (_match, depth, content: string) => {
      const text = content.replace(/<[^>]+>/g, "").trim();
      let id = slugify(text);
      if (!id) id = `heading-${raw.length}`;
      let unique = id;
      let counter = 2;
      while (used.has(unique)) {
        unique = `${id}-${counter++}`;
      }
      used.add(unique);
      raw.push({ id: unique, text, depth: Number(depth) });
      return `<h${depth} id="${unique}">${content}</h${depth}>`;
    },
  );

  // Collapse "PASAL N" + following h2 into one TOC entry. The DOM keeps both
  // h2 elements with their own ids; we only fuse them visually in the nav.
  const toc: ContractTocEntry[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw[i + 1];
    if (
      cur.depth === 2 &&
      /^pasal\s+\d+$/i.test(cur.text) &&
      next?.depth === 2
    ) {
      toc.push({
        id: cur.id, // anchor to PASAL header
        depth: 2,
        text: `${toTitleCase(cur.text)} — ${toTitleCase(next.text)}`,
      });
      i += 1; // consume the merged sibling
      continue;
    }
    toc.push({ ...cur, text: toTitleCase(cur.text) });
  }
  return { html: newHtml, toc };
}

/**
 * Convert "PASAL 1" / "LATAR BELAKANG" / "8.2.1 Pelanggaran Ringan" into
 * sentence case for prettier TOC labels, while leaving real proper nouns
 * (anything in the title that isn't all-caps) untouched.
 */
function toTitleCase(s: string): string {
  if (!/[a-z]/.test(s)) {
    // All-caps headline — re-case to "Title Case".
    return s
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

// ─── Interpolation ────────────────────────────────────────────────────────

export type InterpolationContext = {
  identity: IdentitySnapshot;
  contractNumber: string;
  signedAt: Date;
};

/**
 * Replace template placeholders in the contract body with real mentor data.
 *
 * The template uses these placeholders (matching the source markdown):
 * - `____/ST-MTR/____/20__` → contract number
 * - `pada hari ______, tanggal ___ bulan _______ tahun ____ (__-__-20__)` → signing date
 * - `[Nama Lengkap Mentor]` (3 occurrences in comparisi + signing block)
 * - `lahir di [tempat], pada tanggal [tgl/bln/thn]` → place + DOB
 * - `pemegang [Kartu Tanda Penduduk (KTP) / Paspor] Nomor ________________`
 * - `Nomor Pokok Wajib Pajak (NPWP) ________________`
 * - `beralamat di ________________`
 *
 * The `[Nama Lengkap Mentor]` placeholder also appears as a comment-style
 * `**[Nama Lengkap Mentor]**` in the signing block — replaceAll covers both.
 */
export function interpolateContract(body: string, ctx: InterpolationContext): string {
  const { identity, contractNumber, signedAt } = ctx;
  const idLabel =
    identity.idType === "Paspor"
      ? "Paspor"
      : "Kartu Tanda Penduduk (KTP)";

  return body
    // Contract number — single occurrence in the header.
    .replace(/____\/ST-MTR\/____\/20__/g, contractNumber)
    // Signing date phrase in the comparisi block.
    .replace(
      /pada hari ______, tanggal ___ bulan _______ tahun ____ \(__-__-20__\)/g,
      `pada ${formatSigningDateID(signedAt)}`,
    )
    // Mentor name (appears in comparisi and twice in the signing block).
    .replace(/\[Nama Lengkap Mentor\]/g, identity.fullName)
    // Place + date of birth.
    .replace(
      /lahir di \[tempat\], pada tanggal \[tgl\/bln\/thn\]/g,
      `lahir di ${identity.placeOfBirth}, pada tanggal ${formatDateID(identity.dateOfBirth)}`,
    )
    // ID type + number.
    .replace(
      /pemegang \[Kartu Tanda Penduduk \(KTP\) \/ Paspor\] Nomor ________________/g,
      `pemegang ${idLabel} Nomor ${identity.idNumber}`,
    )
    // NPWP.
    .replace(
      /Nomor Pokok Wajib Pajak \(NPWP\) ________________/g,
      `Nomor Pokok Wajib Pajak (NPWP) ${identity.npwp}`,
    )
    // Address.
    .replace(/beralamat di ________________/g, `beralamat di ${identity.legalAddress}`);
}

// ─── Hashing ──────────────────────────────────────────────────────────────

/**
 * SHA-256 hex over (templateVersion + identitySnapshot + signatureDataUrl).
 * The hash plus the audit row (IP, UA, signedAt) form the integrity record;
 * regenerating from the same inputs reproduces the same hex.
 */
export async function computeSignatureHash(
  templateVersion: string,
  identity: IdentitySnapshot,
  signatureDataUrl: string,
): Promise<string> {
  const payload = `${templateVersion}${JSON.stringify(identity)}${signatureDataUrl}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
