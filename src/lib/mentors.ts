// Single source of truth for the slim mentor list used by HeroSection and MentorMarquee.
// Rich biographical data lives in src/data/mentors.json (used by MentorBioModal).

export type Mentor = {
  fullName: string;
  id: string; // slug; matches MENTOR_PHOTOS keys + mentors.json `id`
  initials: string;
  university: string;
  major: string;
  scholarship: string; // short label, e.g. "LPDP Scholar"
  photo: string | null;
  color: string; // bg-* class — fallback when photo is null
  country?: string;
  flag?: string; // emoji (legacy fallback)
  flagCode?: string; // ISO 3166-1 alpha-2, lowercase — used for flag image
};

export const MENTORS: Mentor[] = [
  {
    fullName: "Akmal Firmansyah",
    id: "akmal-firmansyah",
    initials: "AF",
    university: "University of Cambridge",
    major: "MPhil Earth Sciences",
    scholarship: "LPDP Scholar",
    photo: "/mentors/akmal-firmansyah.jpg",
    color: "bg-primary",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Buna Rizal Rachman",
    id: "buna-rizal-rachman",
    initials: "BR",
    university: "University of Auckland",
    major: "Master of Energy",
    scholarship: "LPDP Scholar",
    photo: "/mentors/buna-rizal-rachman-v2.jpg",
    color: "bg-primary-700",
    country: "New Zealand",
    flag: "🇳🇿",
    flagCode: "nz",
  },
  {
    fullName: "Hanan Hakim",
    id: "hanan-hakim",
    initials: "HH",
    university: "Imperial College London",
    major: "MSc Advanced Materials Science and Engineering",
    scholarship: "Campus Scholarship",
    photo: "/mentors/hanan-hakim.jpg",
    color: "bg-primary-600",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Hasna Hafida",
    id: "hasna-hafida",
    initials: "HH",
    university: "University of Edinburgh",
    major: "MSc Biochemistry",
    scholarship: "LPDP Scholar",
    photo: "/mentors/hasna-hafida-v4.jpg",
    color: "bg-primary-800",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Muhammad Haekal Shafi",
    id: "muhammad-haekal-shafi",
    initials: "HS",
    university: "University of Warwick",
    major: "MSc Sustainable Automotive Electrification",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-haekal-shafi-v3.jpg",
    color: "bg-primary-deep",
    country: "United Kingdom",
    flag: "🇬🇧",
    flagCode: "gb",
  },
  {
    fullName: "Muhammad Aqil Maulana",
    id: "muhammad-aqil-maulana",
    initials: "AM",
    university: "University of Melbourne",
    major: "Master of Information Systems",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-aqil-maulana.jpg",
    color: "bg-primary-700",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Fika Rizkyanti",
    id: "fika-rizkyanti",
    initials: "FR",
    university: "University of Sydney",
    major: "Master of Public Health",
    scholarship: "Australia Awards",
    photo: "/mentors/fika-rizkyanti-v2.jpg",
    color: "bg-primary",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Muhammad Ilham Razak",
    id: "muhammad-ilham",
    initials: "MI",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-ilham.jpg",
    color: "bg-primary-600",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Angela Benedicta Horta",
    id: "angela-benedicta-horta",
    initials: "AH",
    university: "University of Auckland",
    major: "Master of Energy (Geothermal)",
    scholarship: "LPDP Scholar",
    photo: "/mentors/angela-benedicta-horta.jpg",
    color: "bg-primary-800",
    country: "New Zealand",
    flag: "🇳🇿",
    flagCode: "nz",
  },
  {
    fullName: "Raihan Bagus Sakti Aji",
    id: "raihan-bagus-sakti-aji",
    initials: "RA",
    university: "TU Delft",
    major: "MSc Transport, Infrastructure and Logistics",
    scholarship: "LPDP Scholar",
    photo: "/mentors/raihan-bagus-sakti-aji.jpg",
    color: "bg-primary-deep",
    country: "Netherlands",
    flag: "🇳🇱",
    flagCode: "nl",
  },
  {
    fullName: "Arifansyah Wicaksono",
    id: "arifansyah-wicaksono",
    initials: "AW",
    university: "Monash University",
    major: "Master of Cybersecurity",
    scholarship: "LPDP Scholar",
    photo: "/mentors/arifansyah-wicaksono.jpg",
    color: "bg-primary-700",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Isna Arifah Rahmawati",
    id: "isna-arifah-rahmawati",
    initials: "IR",
    university: "University of Sydney",
    major: "Master of Biomedical Science",
    scholarship: "Australia Awards",
    photo: "/mentors/isna-arifah-rahmawati-v2.jpg",
    color: "bg-primary",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Megawati Refra",
    id: "megawati-refra",
    initials: "MR",
    university: "Monash University",
    major: "Master of Applied Marketing",
    scholarship: "LPDP Scholar",
    photo: "/mentors/megawati-refra.jpg",
    color: "bg-primary-600",
    country: "Australia",
    flag: "🇦🇺",
    flagCode: "au",
  },
  {
    fullName: "Nyoman Krisna",
    id: "nyoman-krisna",
    initials: "NK",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholar",
    photo: "/mentors/nyoman-krisna-v2.jpg",
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
  "hanan-hakim": ["/mentors/hanan-hakim-1.jpg"],
  "hasna-hafida": [
    "/mentors/hasna-hafida-1.jpg",
    "/mentors/hasna-hafida-2.jpg",
    "/mentors/hasna-hafida-3.jpg",
    "/mentors/hasna-hafida-4.jpg",
    "/mentors/hasna-hafida-5.jpg",
    "/mentors/hasna-hafida-6.jpg",
  ],
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
