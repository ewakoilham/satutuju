import { supabase } from "@/lib/supabase";
import { getJakartaParts } from "@/lib/datetime-id";

const ROMAN_MONTHS = [
  "I", "II", "III", "IV", "V", "VI",
  "VII", "VIII", "IX", "X", "XI", "XII",
];

export const toRomanMonth = (m: number): string => ROMAN_MONTHS[m - 1] ?? "";

/**
 * Generate the next contract number in the format used by the Perjanjian
 * Kemitraan Mentor template: `{seq:003}/ST-MTR/{romanMonth}/{year}`, e.g.
 * `001/ST-MTR/V/2026`.
 *
 * Month + year resolve in Asia/Jakarta so a mentor signing at 02:00 WIB
 * on Jan 1 (= 19:00 UTC on Dec 31) gets a January-year-N+1 number, not
 * a December-year-N one.
 *
 * Sequence is global across all years (not reset annually) and is derived
 * from the HIGHEST existing sequence + 1 — never the row count. Counting
 * breaks the moment any row is deleted/voided (or the series doesn't start
 * at 001): a gap makes `count + 1` land on a number that already exists, and
 * the `@unique` constraint on `MentorContract.contractNumber` then rejects
 * the insert ("Gagal menyimpan kontrak"). max+1 stays monotonic across gaps.
 * (A true concurrent race could still collide on the same max+1; the unique
 * check rejects the loser and the mentor retries — vanishingly rare here.)
 */
export async function nextContractNumber(now: Date = new Date()): Promise<string> {
  const { data, error } = await supabase
    .from("MentorContract")
    .select("contractNumber");

  if (error) {
    throw new Error(`Failed to read MentorContract rows: ${error.message}`);
  }
  // Leading "NNN" before the first "/" is the global sequence.
  const maxSeq = (data ?? []).reduce((max, row) => {
    const n = parseInt(String(row.contractNumber ?? "").split("/")[0], 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const seq = String(maxSeq + 1).padStart(3, "0");
  const { month, year } = getJakartaParts(now);
  return `${seq}/ST-MTR/${toRomanMonth(month)}/${year}`;
}

// ─── Storage path helpers ─────────────────────────────────────────────────
// Contract numbers contain `/`, which collides with Supabase storage path
// separators. We swap to `_` for filenames and centralize the conversion +
// the canonical paths so every caller (sign, regenerate, admin download,
// archive on resign) stays in lockstep.

export function safeContractNumber(contractNumber: string): string {
  return contractNumber.replace(/\//g, "_");
}

export function contractPdfPath(userId: string, contractNumber: string): string {
  return `contracts/${userId}/${safeContractNumber(contractNumber)}.pdf`;
}

export function archivedContractPdfPath(
  userId: string,
  templateVersion: string,
  contractNumber: string,
): string {
  return `contracts/${userId}/history/${templateVersion}_${safeContractNumber(contractNumber)}.pdf`;
}

// ─── Phase 18: mentee contract numbering + storage paths ──────────────────
// Mentees get their own sequence (`ST-MTE` prefix) counted independently
// against `MenteeContract`. Storage path is segregated under
// `mentee-contracts/` so admin can do a wholesale audit per role without
// PDF cross-contamination.

/**
 * Generate the next mentee contract number in the format
 * `{seq:003}/ST-MTE/{romanMonth}/{year}`, e.g. `001/ST-MTE/V/2026`.
 *
 * Sequence counter is independent of MentorContract — mentees start at
 * 001 even if mentors are already at 040. Same max+1 strategy as the
 * mentor function so deleted/voided rows don't trip the unique
 * constraint.
 */
export async function nextMenteeContractNumber(now: Date = new Date()): Promise<string> {
  const { data, error } = await supabase
    .from("MenteeContract")
    .select("contractNumber");

  if (error) {
    throw new Error(`Failed to read MenteeContract rows: ${error.message}`);
  }
  const maxSeq = (data ?? []).reduce((max, row) => {
    const n = parseInt(String(row.contractNumber ?? "").split("/")[0], 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const seq = String(maxSeq + 1).padStart(3, "0");
  const { month, year } = getJakartaParts(now);
  return `${seq}/ST-MTE/${toRomanMonth(month)}/${year}`;
}

export function menteeContractPdfPath(userId: string, contractNumber: string): string {
  return `mentee-contracts/${userId}/${safeContractNumber(contractNumber)}.pdf`;
}

export function archivedMenteeContractPdfPath(
  userId: string,
  templateVersion: string,
  contractNumber: string,
): string {
  return `mentee-contracts/${userId}/history/${templateVersion}_${safeContractNumber(contractNumber)}.pdf`;
}
