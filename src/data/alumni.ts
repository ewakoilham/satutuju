/**
 * Direktori Alumni data — the public-safe SatuTuju mentor/alumni showcase
 * (`MENTORS` from lib/mentors) enriched with biographical notes from
 * mentors.json. No PII: only what's already shown publicly (name, campus,
 * major, scholarship, country, hometown, story). Drives /dashboard/alumni.
 */

import { MENTORS, type Mentor } from "@/lib/mentors";
import bios from "./mentors.json";

interface BioEntry {
  id: string;
  hometown?: string;
  achievement?: string;
  message?: string;
  s1?: string;
}

export interface Alumni extends Mentor {
  /** Hometown (kota asal). */
  hometown?: string;
  /** A standout achievement, one line. */
  achievement?: string;
  /** The alumnus's own short note / quote. */
  message?: string;
  /** Undergraduate institution. */
  s1?: string;
}

const bioById = new Map((bios as unknown as BioEntry[]).map((b) => [b.id, b]));

export const ALUMNI: Alumni[] = MENTORS.map((m) => {
  const b = bioById.get(m.id);
  return {
    ...m,
    hometown: b?.hometown,
    achievement: b?.achievement,
    message: b?.message,
    s1: b?.s1,
  };
});

/** Distinct destination countries, in descending alumni count. */
export const ALUMNI_COUNTRIES: string[] = Array.from(
  ALUMNI.reduce((map, a) => {
    if (a.country) map.set(a.country, (map.get(a.country) || 0) + 1);
    return map;
  }, new Map<string, number>()),
)
  .sort((a, b) => b[1] - a[1])
  .map(([country]) => country);
