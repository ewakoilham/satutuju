/**
 * Jakarta-time formatters used across the contract UI + audit trail.
 * Wraps `Intl.DateTimeFormat` with `timeZone: "Asia/Jakarta"` so the
 * displayed timestamp matches WIB regardless of where the request is
 * served from (Vercel functions run in UTC) or who's reading it.
 *
 * Storage stays in UTC in the database — only the DISPLAY layer is
 * timezone-aware.
 */

const TZ = "Asia/Jakarta";

const ID_DAY_NAMES = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
];
const ID_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const SHORT_WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Parse an incoming Date|string as UTC. Our DB columns are PostgreSQL
 * `TIMESTAMP(3)` (timezone-naive) — values are written as UTC via
 * `new Date().toISOString()` but Supabase REST returns them without the
 * trailing `Z`. Naked JS `new Date("…")` then mis-interprets the string as
 * local time, which made "16:16 WIB" display as "09:16 WIB" (off by the
 * Jakarta offset). Append `Z` when no timezone marker is present so the
 * value is read back as UTC, matching how it was stored.
 */
function parseAsUtc(d: Date | string): Date {
  if (typeof d !== "string") return d;
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(d) ? new Date(d) : new Date(d + "Z");
}

/** Date + time, e.g. "12 Mei 2026 pukul 14.30 WIB". */
export function formatJakartaDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return (
    parseAsUtc(d).toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: TZ,
    }) + " WIB"
  );
}

/** Compact date, e.g. "12 Mei 2026". */
export function formatJakartaDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return parseAsUtc(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

/** Long date with full month, e.g. "12 Mei 2026". (Same as above but with full month name) */
export function formatJakartaLongDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return parseAsUtc(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

/**
 * Extract Jakarta-local date parts from a Date, regardless of the host
 * machine's timezone. Used by the contract template's signing-date
 * interpolation (which builds a phrase like "Senin, tanggal 12 bulan
 * Mei tahun 2026 (12-05-2026)").
 */
export function getJakartaParts(d: Date): {
  weekdayIndex: number;
  day: number;
  month: number;
  year: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayShort = get("weekday");
  return {
    weekdayIndex: SHORT_WEEKDAY[weekdayShort] ?? 0,
    day: Number(get("day")) || 1,
    month: Number(get("month")) || 1,
    year: Number(get("year")) || new Date().getFullYear(),
  };
}

/**
 * Format the long signing-date phrase used in the contract comparisi
 * block. Always reflects Jakarta time so the rendered contract reads
 * the same regardless of the server's timezone.
 *
 * Returns: "Senin, tanggal 12 bulan Mei tahun 2026 (12-05-2026)"
 */
export function formatSigningDatePhrase(d: Date): string {
  const { weekdayIndex, day, month, year } = getJakartaParts(d);
  return `${ID_DAY_NAMES[weekdayIndex]}, tanggal ${day} bulan ${ID_MONTH_NAMES[month - 1]} tahun ${year} (${pad2(day)}-${pad2(month)}-${year})`;
}
