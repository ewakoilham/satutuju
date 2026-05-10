import { supabase } from "@/lib/supabase";

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
 * Sequence is global across all years (not reset annually) so numbers are
 * unique-by-construction and trivially auditable. Race-safety relies on the
 * `@unique` constraint on `MentorContract.contractNumber` — if two mentors
 * sign within the same millisecond the second insert errors and the caller
 * retries `nextContractNumber()`, which will now see the freshly committed
 * row and return the next sequence.
 */
export async function nextContractNumber(now: Date = new Date()): Promise<string> {
  const { count, error } = await supabase
    .from("MentorContract")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count MentorContract rows: ${error.message}`);
  }
  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${seq}/ST-MTR/${toRomanMonth(now.getMonth() + 1)}/${now.getFullYear()}`;
}
