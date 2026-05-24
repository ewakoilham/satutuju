// Single source of truth for the slim mentor list used by HeroSection and MentorMarquee.
// Rich biographical data lives in src/data/mentors.json (used by MentorBioModal).

export type Mentor = {
  fullName: string;
  id: string; // slug; matches MENTOR_PHOTOS keys + mentors.json `id`
  nickname: string; // friendly short name used in hover/CTAs; admin-overridable
  initials: string;
  university: string;
  major: string;
  scholarship: string; // short label, e.g. "LPDP Scholarship"
  photo: string | null;
  color: string; // bg-* class — fallback when photo is null
  country?: string;
  flag?: string; // emoji (legacy fallback)
  flagCode?: string; // ISO 3166-1 alpha-2, lowercase — used for flag image
};

/**
 * Phase 16 — explicit mentor User → country override map. Source of
 * truth for the mentor leads inbox "Sama dengan negara studiku" match.
 *
 * Keyed by email (lowercased) because User.name is unreliable: some
 * mentor accounts use nicknames ("Venzo"), some use short forms
 * ("razak"), and some use full names ("Akmal Firmansyah"). Email is
 * stable and unique.
 *
 * **When onboarding a new mentor, add their email + country here.**
 *
 * The mentor leads triage stream silently returns 0 matches when a
 * mentor user isn't listed — better to under-match than to spam every
 * lead with a green badge that doesn't apply.
 */
export const MENTOR_USER_COUNTRY: Record<string, string> = {
  // ── Production mentors (sourced from MENTORS array, matched by hand
  //    against the User table emails on 2026-05-24). ─────────────────
  "firmansyah.akmals@gmail.com":  "United Kingdom",   // Akmal Firmansyah
  "bunarizal@gmail.com":          "New Zealand",      // Buna Rizal Rachman
  "hanannhakim@outlook.com":      "United Kingdom",   // Hanan Hakim
  "hasnahafida101@gmail.com":     "United Kingdom",   // Hasna Hafida
  "aqilmaulana1@gmail.com":       "Australia",        // Muhammad Aqil Maulana
  "rizkyantifika@gmail.com":      "Australia",        // Fika Rizkyanti
  "ilham.razak@satutuju.id":      "Australia",        // Muhammad Ilham Razak (work email)
  "ilhamrazakofficial@gmail.com": "Australia",        // Muhammad Ilham Razak (personal)
  "angelhorta313@gmail.com":      "New Zealand",      // Angela Benedicta Horta
  "raihanbagus.work@gmail.com":   "Netherlands",      // Raihan Bagus Sakti Aji
  "arifansyah.wicaksono@gmail.com": "Australia",      // Arifansyah Wicaksono
  "isna.arifahr@gmail.com":       "Australia",        // Isna Arifah Rahmawati
  // ── Admin / power-user accounts that still need country mapping. ──
  "venzozufar47@gmail.com":       "Australia",        // Venzo (admin/mentor hybrid)
};

/**
 * Resolve the coverage country for a mentor user. Used by Phase 16
 * "Sama dengan negara studiku" matching on the mentor leads inbox.
 *
 * Resolution order:
 *   1. Explicit MENTOR_USER_COUNTRY override (by email, case-insensitive).
 *      This is the source of truth — add new mentors here.
 *   2. Name match against MENTORS array (legacy fallback — works when
 *      User.name equals MENTORS[].fullName case-insensitively).
 *
 * Returns null when neither path resolves. Callers should treat null
 * as "matching feature disabled for this user" — never throw.
 */
export function getMentorCountry(args: {
  email?: string | null;
  name?: string | null;
}): string | null {
  if (args.email) {
    const overridden = MENTOR_USER_COUNTRY[args.email.trim().toLowerCase()];
    if (overridden) return overridden;
  }
  if (args.name) {
    const byName = findMentorByUserName(args.name);
    if (byName?.country) return byName.country;
  }
  return null;
}

/** Phase 16 (legacy fallback): resolve the slim Mentor entry that
 *  matches a signed-in mentor user (typically `currentUser.name` from
 *  the JWT). Matches by full name (case-insensitive). Kept as a
 *  fallback inside `getMentorCountry` for mentors whose User.name
 *  happens to equal MENTORS[].fullName — but `MENTOR_USER_COUNTRY` is
 *  the source of truth going forward. */
export function findMentorByUserName(userName: string | null | undefined): Mentor | null {
  if (!userName) return null;
  const target = userName.trim().toLowerCase();
  if (!target) return null;
  return MENTORS.find((m) => m.fullName.toLowerCase() === target) ?? null;
}

export const MENTORS: Mentor[] = [
  {
    fullName: "Akmal Firmansyah",
    id: "akmal-firmansyah",
    nickname: "Akmal",
    initials: "AF",
    university: "University of Cambridge",
    major: "MPhil Earth Sciences",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/akmal-firmansyah-1.jpg",
    color: "bg-primary",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Buna Rizal Rachman",
    id: "buna-rizal-rachman",
    nickname: "Buna",
    initials: "BR",
    university: "University of Auckland",
    major: "Master of Energy",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/buna-rizal-rachman-1.jpg",
    color: "bg-primary-700",
    country: "New Zealand",
    flag: "🇳🇿",
    flagCode: "nz",
  },
  {
    fullName: "Hanan Hakim",
    id: "hanan-hakim",
    nickname: "Hanan",
    initials: "HH",
    university: "Imperial College London",
    major: "MSc Advanced Materials Science and Engineering",
    scholarship: "Departmental Scholarship",
    photo: "/mentors/hanan-hakim-1.png",
    color: "bg-primary-600",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Hasna Hafida",
    id: "hasna-hafida",
    nickname: "Hasna",
    initials: "HH",
    university: "University of Edinburgh",
    major: "MSc Biochemistry",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/hasna-hafida-2.jpg",
    color: "bg-primary-800",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Muhammad Haekal Shafi",
    id: "muhammad-haekal-shafi",
    nickname: "Haekal",
    initials: "HS",
    university: "University of Warwick",
    major: "MSc Sustainable Automotive Electrification",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/muhammad-haekal-shafi-1.jpg",
    color: "bg-primary-deep",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Muhammad Aqil Maulana",
    id: "muhammad-aqil-maulana",
    nickname: "Alan",
    initials: "AM",
    university: "University of Melbourne",
    major: "Master of Information Systems",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/muhammad-aqil-maulana-1.jpg",
    color: "bg-primary-700",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Fika Rizkyanti",
    id: "fika-rizkyanti",
    nickname: "Fika",
    initials: "FR",
    university: "University of Sydney",
    major: "Master of Public Health",
    scholarship: "Australia Awards Scholarship",
    photo: "/mentors/fika-rizkyanti-v2.jpg",
    color: "bg-primary",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Muhammad Ilham Razak",
    id: "muhammad-ilham",
    nickname: "Razak",
    initials: "MI",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/muhammad-ilham-1.jpg",
    color: "bg-primary-600",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Angela Benedicta Horta",
    id: "angela-benedicta-horta",
    nickname: "Angela",
    initials: "AH",
    university: "University of Auckland",
    major: "Master of Energy (Geothermal)",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/angela-benedicta-horta-1.jpg",
    color: "bg-primary-800",
    country: "New Zealand",
    flag: "🇳🇿",
    flagCode: "nz",
  },
  {
    fullName: "Raihan Bagus Sakti Aji",
    id: "raihan-bagus-sakti-aji",
    nickname: "Raihan",
    initials: "RA",
    university: "TU Delft",
    major: "MSc Transport, Infrastructure and Logistics",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/raihan-bagus-sakti-aji-1.jpg",
    color: "bg-primary-deep",
    country: "Netherlands",
    flag: "🇳🇱",
    flagCode: "nl",
  },
  {
    fullName: "Arifansyah Wicaksono",
    id: "arifansyah-wicaksono",
    nickname: "Arif",
    initials: "AW",
    university: "Monash University",
    major: "Master of Cybersecurity",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/arifansyah-wicaksono.jpg",
    color: "bg-primary-700",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Isna Arifah Rahmawati",
    id: "isna-arifah-rahmawati",
    nickname: "Isna",
    initials: "IR",
    university: "University of Sydney",
    major: "Master of Biomedical Science",
    scholarship: "Australia Awards Scholarship",
    photo: "/mentors/isna-arifah-rahmawati-1.jpg",
    color: "bg-primary",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Megawati Refra",
    id: "megawati-refra",
    nickname: "Mega",
    initials: "MR",
    university: "Monash University",
    major: "Master of Applied Marketing",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/megawati-refra-1.jpg",
    color: "bg-primary-600",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Nyoman Krisna",
    id: "nyoman-krisna",
    nickname: "Kris",
    initials: "NK",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholarship",
    photo: "/mentors/nyoman-krisna-1.jpg",
    color: "bg-primary-800",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
];

// Universities for the trust band — short-form names, ordered by global recognition.
// Only includes universities we actually have mentors at (no Oxford, no fakes).
export const TRUST_UNIVERSITIES = [
  "Cambridge",
  "Imperial",
  "Edinburgh",
  "Warwick",
  "Melbourne",
  "Sydney",
  "Monash",
  "Auckland",
  "TU Delft",
];

/**
 * Gallery photos per mentor (id -> ordered list of /public/mentors/* paths).
 * These are the supplementary photos shown in the mentor bio modal — distinct
 * from the avatar (`Mentor.photo` / `MentorBio.avatarPath`) used on cards.
 *
 * Populated from `/public/mentors/{slug}-{n}.jpg` (1..N) — see compress script.
 */
export const MENTOR_PHOTOS: Record<string, string[]> = {
  "akmal-firmansyah": [
    "/mentors/akmal-firmansyah-1.jpg",
    "/mentors/akmal-firmansyah-2.jpg",
    "/mentors/akmal-firmansyah-3.jpg",
    "/mentors/akmal-firmansyah-4.jpg",
    "/mentors/akmal-firmansyah-5.jpg",
  ],
  "angela-benedicta-horta": ["/mentors/angela-benedicta-horta-1.jpg"],
  "arifansyah-wicaksono": [
    "/mentors/arifansyah-wicaksono-1.jpg",
    "/mentors/arifansyah-wicaksono-2.jpg",
  ],
  "buna-rizal-rachman": [
    "/mentors/buna-rizal-rachman-1.jpg",
    "/mentors/buna-rizal-rachman-2.jpg",
    "/mentors/buna-rizal-rachman-3.jpg",
    "/mentors/buna-rizal-rachman-4.jpg",
    "/mentors/buna-rizal-rachman-5.jpg",
  ],
  "fika-rizkyanti": [
    "/mentors/fika-rizkyanti-1.jpg",
    "/mentors/fika-rizkyanti-2.jpg",
    "/mentors/fika-rizkyanti-3.jpg",
    "/mentors/fika-rizkyanti-4.jpg",
    "/mentors/fika-rizkyanti-5.jpg",
  ],
  "hanan-hakim": [
    "/mentors/hanan-hakim-1.png",
    "/mentors/hanan-hakim-2.jpeg",
    "/mentors/hanan-hakim-3.jpeg",
  ],
  "hasna-hafida": [    "/mentors/hasna-hafida-2.jpg",
    "/mentors/hasna-hafida-3.jpg",
    "/mentors/hasna-hafida-4.jpg",
    "/mentors/hasna-hafida-5.jpg",  ],
  "isna-arifah-rahmawati": [
    "/mentors/isna-arifah-rahmawati-1.jpg",
    "/mentors/isna-arifah-rahmawati-2.jpg",
    "/mentors/isna-arifah-rahmawati-3.jpg",
    "/mentors/isna-arifah-rahmawati-4.jpg",
    "/mentors/isna-arifah-rahmawati-5.jpg",
  ],
  "megawati-refra": [
    "/mentors/megawati-refra-1.jpg",
    "/mentors/megawati-refra-2.jpg",
    "/mentors/megawati-refra-3.jpg",
  ],
  "muhammad-aqil-maulana": ["/mentors/muhammad-aqil-maulana-1.jpg"],
  "muhammad-haekal-shafi": [
    "/mentors/muhammad-haekal-shafi-1.jpg",
    "/mentors/muhammad-haekal-shafi-2.jpg",
    "/mentors/muhammad-haekal-shafi-3.jpg",
  ],
  "muhammad-ilham": [
    "/mentors/muhammad-ilham-1.jpg",
    "/mentors/muhammad-ilham-2.jpg",
    "/mentors/muhammad-ilham-3.jpg",
    "/mentors/muhammad-ilham-4.jpg",
  ],
  "nyoman-krisna": ["/mentors/nyoman-krisna-1.jpg"],
  "raihan-bagus-sakti-aji": [
    "/mentors/raihan-bagus-sakti-aji-1.jpg",
    "/mentors/raihan-bagus-sakti-aji-2.jpg",
    "/mentors/raihan-bagus-sakti-aji-3.jpg",
    "/mentors/raihan-bagus-sakti-aji-4.jpg",
    "/mentors/raihan-bagus-sakti-aji-5.jpg",
  ],
};

export function getMentorPhotos(id: string | undefined): string[] {
  if (!id) return [];
  return MENTOR_PHOTOS[id] ?? [];
}
