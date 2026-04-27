// Single source of truth for the slim mentor list used by HeroSection and MentorMarquee.
// Rich biographical data lives in src/data/mentors.json (used by MentorBioModal).

export type Mentor = {
  fullName: string;
  initials: string;
  university: string;
  major: string;
  scholarship: string; // short label, e.g. "LPDP Scholar"
  photo: string | null;
  color: string; // bg-* class — fallback when photo is null
};

export const MENTORS: Mentor[] = [
  {
    fullName: "Akmal Firmansyah",
    initials: "AF",
    university: "University of Cambridge",
    major: "MPhil Earth Sciences",
    scholarship: "LPDP Scholar",
    photo: "/mentors/akmal-firmansyah.jpg",
    color: "bg-primary",
  },
  {
    fullName: "Buna Rizal Rachman",
    initials: "BR",
    university: "University of Auckland",
    major: "Master of Energy",
    scholarship: "LPDP Scholar",
    photo: "/mentors/buna-rizal-rachman-v2.jpg",
    color: "bg-primary-700",
  },
  {
    fullName: "Hanan Hakim",
    initials: "HH",
    university: "Imperial College London",
    major: "MSc Advanced Materials Science and Engineering",
    scholarship: "Campus Scholarship",
    photo: "/mentors/hanan-hakim.jpg",
    color: "bg-primary-600",
  },
  {
    fullName: "Hasna Hafida",
    initials: "HH",
    university: "University of Edinburgh",
    major: "MSc Biochemistry",
    scholarship: "LPDP Scholar",
    photo: "/mentors/hasna-hafida-v4.jpg",
    color: "bg-primary-800",
  },
  {
    fullName: "Muhammad Haekal Shafi",
    initials: "HS",
    university: "University of Warwick",
    major: "MSc Sustainable Automotive Electrification",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-haekal-shafi-v3.jpg",
    color: "bg-primary-deep",
  },
  {
    fullName: "Muhammad Aqil Maulana",
    initials: "AM",
    university: "University of Melbourne",
    major: "Master of Information Systems",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-aqil-maulana.jpg",
    color: "bg-primary-700",
  },
  {
    fullName: "Fika Rizkyanti",
    initials: "FR",
    university: "University of Sydney",
    major: "Master of Public Health",
    scholarship: "Australia Awards",
    photo: "/mentors/fika-rizkyanti-v2.jpg",
    color: "bg-primary",
  },
  {
    fullName: "Muhammad Ilham Razak",
    initials: "MI",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholar",
    photo: "/mentors/muhammad-ilham.jpg",
    color: "bg-primary-600",
  },
  {
    fullName: "Angela Benedicta Horta",
    initials: "AH",
    university: "University of Auckland",
    major: "Master of Energy (Geothermal)",
    scholarship: "LPDP Scholar",
    photo: "/mentors/angela-benedicta-horta.jpg",
    color: "bg-primary-800",
  },
  {
    fullName: "Raihan Bagus Sakti Aji",
    initials: "RA",
    university: "TU Delft",
    major: "MSc Transport, Infrastructure and Logistics",
    scholarship: "LPDP Scholar",
    photo: "/mentors/raihan-bagus-sakti-aji.jpg",
    color: "bg-primary-deep",
  },
  {
    fullName: "Arifansyah Wicaksono",
    initials: "AW",
    university: "Monash University",
    major: "Master of Cybersecurity",
    scholarship: "LPDP Scholar",
    photo: "/mentors/arifansyah-wicaksono.jpg",
    color: "bg-primary-700",
  },
  {
    fullName: "Isna Arifah Rahmawati",
    initials: "IR",
    university: "University of Sydney",
    major: "Master of Biomedical Science",
    scholarship: "Australia Awards",
    photo: "/mentors/isna-arifah-rahmawati-v2.jpg",
    color: "bg-primary",
  },
  {
    fullName: "Megawati Refra",
    initials: "MR",
    university: "Monash University",
    major: "Master of Applied Marketing",
    scholarship: "LPDP Scholar",
    photo: "/mentors/megawati-refra.jpg",
    color: "bg-primary-600",
  },
  {
    fullName: "Nyoman Krisna",
    initials: "NK",
    university: "Monash University",
    major: "Master of Business",
    scholarship: "LPDP Scholar",
    photo: "/mentors/nyoman-krisna-v2.jpg",
    color: "bg-primary-800",
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
