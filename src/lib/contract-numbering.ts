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
 * Sequence is global across all years (not reset annually). The
 * `@unique` constraint on `MentorContract.contractNumber` guarantees no
 * duplicates land — if two mentors race the same sequence, the second
 * insert fails the unique check and the caller surfaces the error.
 */
export async function nextContractNumber(now: Date = new Date()): Promise<string> {
  const { count, error } = await supabase
    .from("MentorContract")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count MentorContract rows: ${error.message}`);
  }
  const seq = String((count ?? 0) + 1).padStart(3, "0");
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
