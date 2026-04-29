/**
 * Runtime mentor list — merges the static seed (mentors.ts) with rows from the
 * `Mentor` Supabase table, so admin-added mentors appear automatically on the
 * landing page (hero, marquee, bio modal) without redeploys.
 */

import type { Mentor } from "./mentors";

/** Row shape returned by /api/mentors (matches the Supabase Mentor table). */
export type DbMentor = {
  id: string;
  fullName: string;
  nickname: string;
  initials: string;
  university: string;
  major: string;
  country: string;
  flagCode: string | null;
  scholarship: string | null;
  color: string | null;
  avatarPath: string | null;
  galleryPaths: string[];
  hometown: string | null;
  message: string | null;
  achievement: string | null;
  currentStudiesRaw: string | null;
  s1: string | null;
  scholarshipRaw: string | null;
  isActive: boolean;
  displayOrder: number;
  source: "admin" | "seed";
};

/**
 * Unified shape used by every landing-page consumer. Adds bio-modal fields and
 * a `dbSource` marker so admin tools can distinguish DB rows from JSON seed.
 */
export type MergedMentor = Mentor & {
  /** Where this entry came from. JSON seed = "static"; Supabase row = "db". */
  dbSource: "static" | "db";
  galleryPaths?: string[];
  hometown?: string | null;
  message?: string | null;
  achievement?: string | null;
  currentStudiesRaw?: string | null;
  s1?: string | null;
  scholarshipRaw?: string | null;
};

/** Convert a DbMentor row into the MergedMentor shape consumed by the UI. */
export function dbMentorToMerged(d: DbMentor): MergedMentor {
  return {
    id: d.id,
    fullName: d.fullName,
    nickname: d.nickname,
    initials: d.initials,
    university: d.university,
    major: d.major,
    scholarship: d.scholarship ?? "",
    photo: d.avatarPath,
    color: d.color ?? "bg-primary",
    country: d.country,
    flagCode: d.flagCode ?? undefined,
    dbSource: "db",
    galleryPaths: d.galleryPaths ?? [],
    hometown: d.hometown,
    message: d.message,
    achievement: d.achievement,
    currentStudiesRaw: d.currentStudiesRaw,
    s1: d.s1,
    scholarshipRaw: d.scholarshipRaw,
  };
}

/** Static seed mentors first (preserves existing landing-page order), then
 *  active DB mentors sorted by displayOrder. Inactive rows are filtered out. */
export function mergeMentorLists(
  staticList: Mentor[],
  dbList: DbMentor[],
): MergedMentor[] {
  const fromStatic: MergedMentor[] = staticList.map((m) => ({
    ...m,
    dbSource: "static",
  }));
  const fromDb = [...dbList]
    .filter((d) => d.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(dbMentorToMerged);
  return [...fromStatic, ...fromDb];
}

/** Build a slug from a full name. Used as the row primary key for new
 *  admin-created mentors. Strips diacritics, lowercases, hyphenates. */
export function suggestMentorId(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Build initials from a full name ("Akmal Firmansyah" → "AF"). */
export function suggestInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
