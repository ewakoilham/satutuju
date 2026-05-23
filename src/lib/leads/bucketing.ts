import type { LeadBucket, ParsedField } from "./types";

/** A mentor entry with at minimum a country — accepts both the seed type
 *  (src/lib/mentors.ts) and the merged runtime type. */
interface MentorLike {
  country?: string | null;
}

export interface BucketResult {
  bucket: LeadBucket;
  reason: string;
  parsedCountry: string | null;
  parsedCampus: string | null;
  parsedField: ParsedField;
  isCampusPartner: boolean | null;
  hasCountryMentor: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Curated campus aliases. Only includes universities that Indonesian
// students commonly target for master's/PhD abroad. Hand-curated for
// high precision — avoids the noise of scanning all 3000+ rows in
// universities.json (where common words like "Business", "London",
// "Engineering" would match dozens of irrelevant entries).
//
// Edit / extend here as the operator's lead base grows. Order doesn't
// matter — longest matched canonical wins.
// ──────────────────────────────────────────────────────────────────────────

interface CampusAlias {
  canonical: string;
  country: string;
  patterns: string[]; // regex source strings, word-boundary handled by matcher
  // Defaults to true. Set to false for universities we recognize purely
  // to disambiguate the country (e.g. Italian universities help us route
  // to Italy bucket D) but that are NOT in our partner network.
  isPartner?: boolean;
}

const CAMPUS_ALIASES: CampusAlias[] = [
  // ── Australia ────────────────────────────────────────────────────────────
  { canonical: "Monash University",             country: "Australia",      patterns: ["monash"] },
  { canonical: "University of Melbourne",       country: "Australia",      patterns: ["university of melbourne", "melbourne uni", "unimelb", "uom"] },
  { canonical: "University of Sydney",          country: "Australia",      patterns: ["university of sydney", "usyd", "sydney uni"] },
  { canonical: "UNSW Sydney",                   country: "Australia",      patterns: ["unsw", "university of new south wales"] },
  { canonical: "Australian National University", country: "Australia",     patterns: ["anu", "australian national"] },
  { canonical: "University of Queensland",      country: "Australia",      patterns: ["university of queensland", "uq\\b"] },
  { canonical: "University of Adelaide",        country: "Australia",      patterns: ["university of adelaide", "adelaide uni"] },
  { canonical: "Macquarie University",          country: "Australia",      patterns: ["macquarie"] },
  { canonical: "RMIT University",               country: "Australia",      patterns: ["rmit"] },
  { canonical: "University of Western Australia", country: "Australia",    patterns: ["uwa\\b", "university of western australia"] },
  { canonical: "UTS Sydney",                    country: "Australia",      patterns: ["uts\\b", "university of technology sydney"] },

  // ── United Kingdom ───────────────────────────────────────────────────────
  { canonical: "University of Cambridge",       country: "United Kingdom",             patterns: ["cambridge", "cantab", "cambradge"] },
  { canonical: "University of Oxford",          country: "United Kingdom",             patterns: ["oxford", "oxon"] },
  { canonical: "Imperial College London",       country: "United Kingdom",             patterns: ["imperial college", "imperial"] },
  { canonical: "University College London",     country: "United Kingdom",             patterns: ["ucl\\b", "university college london"] },
  { canonical: "London School of Economics",    country: "United Kingdom",             patterns: ["lse\\b", "london school of economics"] },
  { canonical: "King's College London",         country: "United Kingdom",             patterns: ["kcl\\b", "king'?s college", "kings college london"] },
  { canonical: "University of Warwick",         country: "United Kingdom",             patterns: ["warwick"] },
  // "Manchester University" (reversed word order) is a common informal
  // variant — accept both. Bare "manchester" by itself is too broad
  // (city name) so we anchor on the word "university" or "uni".
  { canonical: "University of Manchester",      country: "United Kingdom",             patterns: ["university of manchester", "manchester university", "manchester uni"] },
  { canonical: "University of Edinburgh",       country: "United Kingdom",             patterns: ["university of edinburgh", "edinburgh uni"] },
  { canonical: "University of Glasgow",         country: "United Kingdom",             patterns: ["university of glasgow", "glasgow uni"] },
  { canonical: "University of Bristol",         country: "United Kingdom",             patterns: ["university of bristol", "bristol uni"] },
  { canonical: "University of Leeds",           country: "United Kingdom",             patterns: ["university of leeds", "leeds uni"] },
  { canonical: "University of Sheffield",       country: "United Kingdom",             patterns: ["university of sheffield", "sheffield uni"] },
  { canonical: "University of Birmingham",      country: "United Kingdom",             patterns: ["university of birmingham", "birmingham uni"] },
  { canonical: "University of Nottingham",      country: "United Kingdom",             patterns: ["university of nottingham", "nottingham uni"] },
  { canonical: "Durham University",             country: "United Kingdom",             patterns: ["durham"] },
  { canonical: "University of Bath",            country: "United Kingdom",             patterns: ["university of bath", "bath uni"] },
  { canonical: "Queen Mary University of London", country: "United Kingdom",           patterns: ["queen mary", "qmul"] },
  { canonical: "University of St Andrews",      country: "United Kingdom",             patterns: ["st andrews", "st\\. andrews"] },
  { canonical: "Lancaster University",          country: "United Kingdom",             patterns: ["lancaster"] },
  { canonical: "University of Southampton",     country: "United Kingdom",             patterns: ["southampton"] },
  { canonical: "University of Exeter",          country: "United Kingdom",             patterns: ["exeter"] },
  { canonical: "University of York",            country: "United Kingdom",             patterns: ["university of york", "york uni"] },

  // ── New Zealand ──────────────────────────────────────────────────────────
  { canonical: "University of Auckland",        country: "New Zealand",    patterns: ["university of auckland", "auckland uni", "uoa\\b"] },
  { canonical: "Victoria University of Wellington", country: "New Zealand", patterns: ["victoria university of wellington", "vuw\\b"] },
  { canonical: "University of Otago",           country: "New Zealand",    patterns: ["otago"] },
  { canonical: "University of Canterbury",      country: "New Zealand",    patterns: ["university of canterbury"] },

  // ── Netherlands ──────────────────────────────────────────────────────────
  { canonical: "TU Delft",                      country: "Netherlands",    patterns: ["tu delft", "delft university of technology"] },
  { canonical: "Wageningen University",         country: "Netherlands",    patterns: ["wageningen"] },
  { canonical: "Utrecht University",            country: "Netherlands",    patterns: ["utrecht"] },
  { canonical: "Leiden University",             country: "Netherlands",    patterns: ["leiden"] },
  { canonical: "University of Amsterdam",       country: "Netherlands",    patterns: ["university of amsterdam", "uva\\b"] },
  { canonical: "Erasmus University Rotterdam",  country: "Netherlands",    patterns: ["erasmus", "rotterdam"] },
  { canonical: "Maastricht University",         country: "Netherlands",    patterns: ["maastricht"] },
  { canonical: "Eindhoven University of Technology", country: "Netherlands", patterns: ["eindhoven", "tu eindhoven", "tue\\b"] },
  { canonical: "Groningen University",          country: "Netherlands",    patterns: ["groningen"] },

  // ── USA ──────────────────────────────────────────────────────────────────
  { canonical: "MIT",                           country: "United States",            patterns: ["\\bmit\\b", "massachusetts institute of technology"] },
  { canonical: "Harvard University",            country: "United States",            patterns: ["harvard"] },
  { canonical: "Stanford University",           country: "United States",            patterns: ["stanford"] },
  { canonical: "Yale University",               country: "United States",            patterns: ["yale"] },
  { canonical: "Princeton University",          country: "United States",            patterns: ["princeton"] },
  { canonical: "Columbia University",           country: "United States",            patterns: ["columbia university", "columbia uni"] },
  { canonical: "University of Pennsylvania",    country: "United States",            patterns: ["upenn", "university of pennsylvania", "wharton"] },
  { canonical: "Cornell University",            country: "United States",            patterns: ["cornell"] },
  { canonical: "UC Berkeley",                   country: "United States",            patterns: ["uc berkeley", "berkeley", "ucb\\b"] },
  { canonical: "UCLA",                          country: "United States",            patterns: ["ucla"] },
  { canonical: "NYU",                           country: "United States",            patterns: ["\\bnyu\\b", "new york university"] },
  { canonical: "University of Chicago",         country: "United States",            patterns: ["university of chicago", "uchicago"] },
  { canonical: "Caltech",                       country: "United States",            patterns: ["caltech", "california institute of technology"] },
  { canonical: "Georgia Tech",                  country: "United States",            patterns: ["georgia tech", "georgia institute of technology"] },
  { canonical: "Carnegie Mellon University",    country: "United States",            patterns: ["carnegie mellon", "\\bcmu\\b"] },
  { canonical: "Johns Hopkins University",      country: "United States",            patterns: ["johns hopkins", "\\bjhu\\b"] },
  { canonical: "Duke University",               country: "United States",            patterns: ["duke"] },
  { canonical: "Northwestern University",       country: "United States",            patterns: ["northwestern"] },
  { canonical: "University of Michigan",        country: "United States",            patterns: ["university of michigan", "umich"] },

  // ── Canada ───────────────────────────────────────────────────────────────
  { canonical: "University of Toronto",         country: "Canada",         patterns: ["university of toronto", "u of t", "uoft"] },
  { canonical: "UBC",                           country: "Canada",         patterns: ["ubc\\b", "university of british columbia"] },
  { canonical: "McGill University",             country: "Canada",         patterns: ["mcgill"] },
  { canonical: "University of Waterloo",        country: "Canada",         patterns: ["university of waterloo", "uwaterloo"] },
  { canonical: "University of Alberta",         country: "Canada",         patterns: ["university of alberta", "ualberta"] },
  { canonical: "Queen's University",            country: "Canada",         patterns: ["queen'?s university", "queens university"] },
  { canonical: "Western University",            country: "Canada",         patterns: ["western university", "uwo\\b"] },
  { canonical: "McMaster University",           country: "Canada",         patterns: ["mcmaster"] },

  // ── Germany ──────────────────────────────────────────────────────────────
  { canonical: "TU Munich",                     country: "Germany",        patterns: ["tu munich", "tum\\b", "technical university of munich", "technische universität münchen"] },
  { canonical: "LMU Munich",                    country: "Germany",        patterns: ["lmu\\b", "ludwig maximilian", "lmu munich"] },
  { canonical: "Heidelberg University",         country: "Germany",        patterns: ["heidelberg"] },
  { canonical: "Humboldt University Berlin",    country: "Germany",        patterns: ["humboldt"] },
  { canonical: "Free University of Berlin",     country: "Germany",        patterns: ["free university of berlin", "freie universität berlin"] },
  { canonical: "TU Berlin",                     country: "Germany",        patterns: ["tu berlin", "technical university of berlin"] },
  { canonical: "RWTH Aachen",                   country: "Germany",        patterns: ["rwth", "aachen"] },

  // ── Singapore ────────────────────────────────────────────────────────────
  { canonical: "NUS",                           country: "Singapore",      patterns: ["nus\\b", "national university of singapore"] },
  { canonical: "NTU Singapore",                 country: "Singapore",      patterns: ["ntu\\b", "nanyang technological"] },
  { canonical: "SMU Singapore",                 country: "Singapore",      patterns: ["smu\\b", "singapore management"] },
  { canonical: "SUTD",                          country: "Singapore",      patterns: ["sutd"] },

  // ── France ───────────────────────────────────────────────────────────────
  { canonical: "HEC Paris",                     country: "France",         patterns: ["hec paris", "hec\\b"] },
  { canonical: "Sciences Po",                   country: "France",         patterns: ["sciences po"] },
  { canonical: "ESSEC Business School",         country: "France",         patterns: ["essec"] },
  { canonical: "INSEAD",                        country: "France",         patterns: ["insead"] },
  { canonical: "ESCP Business School",          country: "France",         patterns: ["escp"] },

  // ── Switzerland ──────────────────────────────────────────────────────────
  { canonical: "ETH Zurich",                    country: "Switzerland",    patterns: ["eth zurich", "eth zürich", "eth\\b"] },
  { canonical: "EPFL",                          country: "Switzerland",    patterns: ["epfl"] },
  { canonical: "University of St Gallen",       country: "Switzerland",    patterns: ["university of st gallen", "st gallen"] },

  // ── Sweden ───────────────────────────────────────────────────────────────
  { canonical: "KTH Royal Institute",           country: "Sweden",         patterns: ["kth\\b"] },
  { canonical: "Stockholm University",          country: "Sweden",         patterns: ["stockholm university"] },
  { canonical: "Lund University",               country: "Sweden",         patterns: ["lund"] },
  { canonical: "Uppsala University",            country: "Sweden",         patterns: ["uppsala"] },
  { canonical: "Chalmers University",           country: "Sweden",         patterns: ["chalmers"] },

  // ── Ireland ──────────────────────────────────────────────────────────────
  { canonical: "Trinity College Dublin",        country: "Ireland",        patterns: ["trinity college dublin", "tcd\\b"] },
  { canonical: "University College Dublin",     country: "Ireland",        patterns: ["ucd\\b", "university college dublin"] },

  // ── Hong Kong ────────────────────────────────────────────────────────────
  { canonical: "University of Hong Kong",       country: "Hong Kong",      patterns: ["university of hong kong", "hku\\b"] },
  { canonical: "HKUST",                         country: "Hong Kong",      patterns: ["hkust", "hong kong university of science"] },
  { canonical: "CUHK",                          country: "Hong Kong",      patterns: ["cuhk", "chinese university of hong kong"] },

  // ── Japan ────────────────────────────────────────────────────────────────
  { canonical: "University of Tokyo",           country: "Japan",          patterns: ["university of tokyo", "todai", "u-tokyo"] },
  { canonical: "Kyoto University",              country: "Japan",          patterns: ["kyoto university"] },
  { canonical: "Osaka University",              country: "Japan",          patterns: ["osaka university"] },
  { canonical: "Waseda University",             country: "Japan",          patterns: ["waseda"] },
  { canonical: "Keio University",               country: "Japan",          patterns: ["keio"] },

  // ── South Korea ──────────────────────────────────────────────────────────
  { canonical: "Seoul National University",     country: "South Korea",    patterns: ["seoul national", "snu\\b"] },
  { canonical: "KAIST",                         country: "South Korea",    patterns: ["kaist"] },
  { canonical: "POSTECH",                       country: "South Korea",    patterns: ["postech"] },
  { canonical: "Yonsei University",             country: "South Korea",    patterns: ["yonsei"] },
  { canonical: "Korea University",              country: "South Korea",    patterns: ["korea university"] },

  // ── Italy (country disambiguator only — no partner network here yet) ────
  // These entries help classifyLead route the lead to Italy (and therefore
  // bucket D), but do NOT mark the campus as a Satu Tuju partner.
  { canonical: "University of Ferrara",         country: "Italy",          patterns: ["ferrara"],                                isPartner: false },
  { canonical: "Bocconi University",            country: "Italy",          patterns: ["bocconi"],                                isPartner: false },
  { canonical: "Politecnico di Milano",         country: "Italy",          patterns: ["politecnico di milano", "polimi"],        isPartner: false },
  { canonical: "University of Bologna",         country: "Italy",          patterns: ["university of bologna", "unibo"],         isPartner: false },
];

// ──────────────────────────────────────────────────────────────────────────
// Country keyword map. Used when no specific campus is matched. Each
// pattern is a regex source string (word boundaries added by matcher).
// ──────────────────────────────────────────────────────────────────────────

interface CountryKeyword {
  country: string;
  patterns: string[];
}

const COUNTRY_KEYWORDS: CountryKeyword[] = [
  { country: "Australia",     patterns: ["australia", "australian", "aussie", "aus\\b", "au\\b"] },
  { country: "United Kingdom",            patterns: ["united kingdom", "england", "scotland", "wales", "britain", "british", "uk\\b", "u\\.?k\\.?\\b", "inggris"] },
  { country: "New Zealand",   patterns: ["new zealand", "selandia baru", "nz\\b", "n\\.?z\\.?\\b"] },
  { country: "Netherlands",   patterns: ["netherlands", "holland", "belanda", "dutch"] },
  { country: "Canada",        patterns: ["canada", "canadian", "kanada"] },
  { country: "United States",           patterns: ["united states", "amerika serikat", "amerika", "america", "american", "usa\\b", "u\\.?s\\.?a?\\.?\\b"] },
  { country: "Germany",       patterns: ["germany", "deutschland", "jerman", "german"] },
  { country: "Singapore",     patterns: ["singapore", "singapura"] },
  { country: "Japan",         patterns: ["japan", "jepang"] },
  { country: "South Korea",   patterns: ["south korea", "korea selatan", "south korean"] },
  { country: "France",        patterns: ["france", "perancis", "prancis", "french"] },
  { country: "Switzerland",   patterns: ["switzerland", "swiss"] },
  { country: "Sweden",        patterns: ["sweden", "swedia"] },
  { country: "Ireland",       patterns: ["ireland", "irlandia"] },
  { country: "Hong Kong",     patterns: ["hong kong"] },
  { country: "Malaysia",      patterns: ["malaysia", "malaysian"] },
  // ── Countries we do NOT yet cover (mentor + partner both absent) ────────
  // These resolve via country match into bucket D so the admin can send
  // the "outside our network" template. Extend as new request patterns
  // appear in the leads queue.
  { country: "Italy",         patterns: ["italy", "italia", "italian"] },
  { country: "Qatar",         patterns: ["qatar", "qatari"] },
  { country: "Hungary",       patterns: ["hungary", "hungaria", "hungarian"] },
  { country: "China",         patterns: ["china", "tiongkok", "tionghoa", "chinese"] },
  { country: "Russia",        patterns: ["russia", "rusia", "russian"] },
  { country: "Colombia",      patterns: ["colombia", "kolombia", "colombian"] },
  // Region — applicant said "Europe" without specifying. Flagged as a
  // pseudo-country so it falls through to bucket D (no mentor, no
  // partner can match a vague region). Admin can follow up.
  { country: "Europe",        patterns: ["europe", "eropa"] },
];

// ──────────────────────────────────────────────────────────────────────────
// Field keyword map.
// ──────────────────────────────────────────────────────────────────────────

const STEM_KEYWORDS = [
  "engineering", "engineer", "teknik", "technology", "computer", "computing",
  "software", "informatics", "informatika", "data science", "data analytics",
  "biomedical", "biotech", "biology", "biologi", "chemistry", "kimia",
  "physics", "fisika", "mathematics", "matematika", "statistics", "statistik",
  "energy", "energi", "materials", "material science", "mechanical", "mekanik",
  "electrical", "elektro", "civil engineering", "\\bai\\b", "machine learning",
  "deep learning", "robotics", "robotik", "aerospace", "aeronautical",
  "petroleum", "geology", "geologi", "geoscience", "environmental",
  "neuroscience", "medicine", "kedokteran", "pharmacy", "farmasi",
  "public health", "kesehatan masyarakat", "nursing", "keperawatan",
  "architecture", "arsitektur",
];

const BUSINESS_KEYWORDS = [
  "business", "bisnis", "\\bmba\\b", "management", "manajemen", "marketing",
  "pemasaran", "finance", "keuangan", "accounting", "akuntansi",
  "economics", "ekonomi", "entrepreneurship", "kewirausahaan",
  "supply chain", "operations", "strategy", "strategi", "consulting", "konsultasi",
  "hospitality", "tourism", "pariwisata", "international business",
  // Public policy / IR / law / education — treated as Business-ish since
  // mentors typically advise these via the same admission process.
  "public policy", "kebijakan publik", "international relations", "hubungan internasional",
  "law\\b", "hukum", "education", "pendidikan", "psychology", "psikologi",
  "communications?", "komunikasi", "journalism", "jurnalisme",
  "social work", "sociology", "sosiologi", "anthropology", "antropologi",
];

// ──────────────────────────────────────────────────────────────────────────
// classifyLead — entrypoint
// ──────────────────────────────────────────────────────────────────────────

export function classifyLead(
  targetCampusAndProgram: string,
  mentors: MentorLike[],
): BucketResult {
  const rawTrimmed = targetCampusAndProgram.trim();
  const normInput = " " + normalize(targetCampusAndProgram) + " ";

  // Step 0: incomplete short-circuit. Applicant left the target field
  // blank (sync layer fills it with "(target tidak diisi)") OR wrote
  // pure placeholder dashes like "-" / "-, -". These need a separate
  // re-engagement template, not the regular A_B_C / D flow.
  if (isIncompleteInput(rawTrimmed, normInput)) {
    return {
      bucket: "incomplete",
      reason: `Target kampus & negara belum diisi di Tally (input: "${targetCampusAndProgram || "—"}")`,
      parsedCountry: null,
      parsedCampus: null,
      parsedField: "unclear",
      isCampusPartner: null,
      hasCountryMentor: false,
    };
  }

  // Step 1+3: match a specific campus from the curated alias list.
  const campusMatch = matchCampus(normInput);
  const parsedCampus = campusMatch?.canonical ?? null;
  let parsedCountry = campusMatch?.country ?? null;

  // Step 1 fallback: country keyword scan.
  if (!parsedCountry) parsedCountry = matchCountry(normInput);

  // Step 1b: domestic detection. Runs AFTER foreign-campus + foreign-
  // country matchers so inputs like "University of Ferrara, Indonesia"
  // resolve to Italy (Ferrara is in the alias list) rather than domestic.
  // We only declare domestic when no foreign signal landed.
  if (parsedCountry === null && isDomesticIndonesia(normInput, rawTrimmed)) {
    return {
      bucket: "domestic",
      reason: `Target di Indonesia (input: "${targetCampusAndProgram}") — Satu Tuju fokus studi ke luar negeri`,
      parsedCountry: "Indonesia",
      parsedCampus: null,
      parsedField: matchField(normInput),
      isCampusPartner: null,
      hasCountryMentor: false,
    };
  }

  // Step 2: field
  const parsedField = matchField(normInput);

  // Step 4: cross-reference
  const hasCountryMentor =
    parsedCountry !== null && mentors.some((m) => (m.country ?? "") === parsedCountry);
  // Tri-state semantics:
  //   true  → alias matched AND alias is in our partner network
  //   false → alias matched but explicitly NOT a partner (country-only hint)
  //   null  → no specific campus parsed
  const isCampusPartner: boolean | null =
    parsedCampus !== null ? (campusMatch?.isPartner ?? true) : null;

  // Step 5: assign bucket — country is the only hard requirement. Field
  // is captured for downstream filtering but doesn't gate bucketing
  // (the Tally form doesn't always include program/field info).
  //
  // Bucket semantics:
  //   A = mentor available + campus is partner (best)
  //   B = mentor only (campus not partner)
  //   C = partner kampus only (no mentor in country)
  //   D = neither mentor nor partner (worst)
  let bucket: LeadBucket = "unclassified";
  if (parsedCountry === null) {
    bucket = "unclassified";
  } else if (hasCountryMentor && isCampusPartner === true) {
    bucket = "A";
  } else if (hasCountryMentor && isCampusPartner !== true) {
    bucket = "B";
  } else if (!hasCountryMentor && isCampusPartner === true) {
    bucket = "C";
  } else {
    bucket = "D";
  }

  const reason = buildReason({
    bucket,
    parsedCountry,
    parsedCampus,
    parsedField,
    hasCountryMentor,
    isCampusPartner,
    input: targetCampusAndProgram,
  });

  return {
    bucket,
    reason,
    parsedCountry,
    parsedCampus,
    parsedField,
    isCampusPartner,
    hasCountryMentor,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wrap a pattern with leading AND trailing `\b`, idempotently. Prevents
 *  bugs from patterns that only include one boundary (e.g. "usa\\b"
 *  matching "us" in "kampus" because the leading boundary was missing). */
function wb(p: string): string {
  const stripped = p.replace(/^\\b/, "").replace(/\\b$/, "");
  return `\\b${stripped}\\b`;
}

function matchCountry(normInput: string): string | null {
  for (const { country, patterns } of COUNTRY_KEYWORDS) {
    for (const p of patterns) {
      if (new RegExp(wb(p), "i").test(normInput)) return country;
    }
  }
  return null;
}

/** True when the applicant left the target field blank or filled it with
 *  pure placeholder content. Handles the sync-layer sentinel
 *  "(target tidak diisi)" plus common manual placeholders.
 *
 *  `rawTrimmed` is the original input minus surrounding whitespace.
 *  `normInput` is the matcher-normalized form with sentinel spaces on
 *  both sides (lowercased, diacritics stripped). */
function isIncompleteInput(rawTrimmed: string, normInput: string): boolean {
  if (rawTrimmed === "") return true;
  if (/^\s*\(?\s*target tidak diisi\s*\)?\s*$/i.test(rawTrimmed)) return true;
  // Pure dash placeholders: "-", "-, -", "- , -", etc.
  if (/^[\s\-,.]+$/.test(rawTrimmed)) return true;
  // Generic "n/a", "tba", "belum tahu", "tidak tahu"
  if (/\b(n\/?a|tba|belum tahu|tidak tahu|gak tahu|nggak tahu)\b/i.test(normInput.trim())) {
    // Only if that's basically all the input says (≤25 chars after norm).
    if (normInput.trim().length <= 25) return true;
  }
  return false;
}

/** Common Indonesian cities that host universities. Used as a fallback
 *  domestic signal for English-named campuses like "Garut University,
 *  Garut" — applicant didn't write "Indonesia" but the city is a
 *  giveaway. Only triggers when no foreign signal matched first.
 *
 *  Curated to avoid known ambiguities — Padang (also a city in Spain
 *  context "padang grass"? rare), Bogor (uniquely Indonesian). Extend
 *  as new domestic submissions appear. */
const INDONESIAN_CITY_KEYWORDS = [
  "jakarta", "bandung", "surabaya", "yogyakarta", "yogya", "jogja", "jogjakarta",
  "medan", "semarang", "palembang", "makassar", "denpasar", "bali",
  "malang", "solo", "balikpapan", "samarinda", "banjarmasin", "manado",
  "padang", "pekanbaru", "bogor", "depok", "tangerang", "bekasi",
  "sukabumi", "cirebon", "tasikmalaya", "garut", "purwokerto",
  "mataram", "lombok", "jayapura", "kupang", "ambon", "ternate",
  "bengkulu", "jambi", "lampung", "aceh", "pontianak", "kendari",
];

/** True when the applicant's target is clearly in Indonesia — either
 *  spelled out ("indonesia", "ID"), Bahasa-specific university lexicon
 *  ("universitas …"), known Indonesian abbreviation, or a recognized
 *  Indonesian city paired with university/institute lexicon. Runs AFTER
 *  all foreign-campus and foreign-country matchers so cases like
 *  "University of Ferrara, Indonesia" still resolve to Italy. */
function isDomesticIndonesia(normInput: string, rawTrimmed: string): boolean {
  const trimmedLower = rawTrimmed.toLowerCase();
  // Bare country code: applicant wrote literally "ID" (or "id" / " id ").
  if (/^id$/i.test(trimmedLower)) return true;
  // Word match: "indonesia" anywhere in normalized input.
  if (/\bindonesia\b/i.test(normInput)) return true;
  // Bahasa-specific lexicon — "Universitas X" is uniquely Indonesian.
  if (/\buniversitas\b/i.test(normInput)) return true;
  // Common Indonesian university abbreviations (word-bounded).
  if (/\b(itb|ugm|its|ipb|unair|unpad|unsri|unhas|undip|uin|unesa|usu)\b/i.test(normInput)) return true;
  // City + campus-word combo: "Garut University, Garut", "Bogor
  // Institute …". Only when paired with a university/institute keyword
  // so a stray city name doesn't trigger.
  const hasCampusWord = /\b(university|institute|college|sekolah tinggi|politeknik|akademi)\b/i.test(normInput);
  if (hasCampusWord) {
    for (const city of INDONESIAN_CITY_KEYWORDS) {
      if (new RegExp(`\\b${city}\\b`, "i").test(normInput)) return true;
    }
  }
  return false;
}

/** Detect whether input includes program / degree context. Without this,
 *  generic university names like "Harvard Business School" or "Institute
 *  of Technology" would trigger false-positive STEM/Business matches just
 *  from the school's own name. We only attempt field detection when the
 *  applicant explicitly mentions a program. */
const PROGRAM_KEYWORDS = [
  "master", "magister", "phd", "doctor", "doctoral", "bachelor",
  "s1", "s2", "s3", "msc", "\\bma\\b", "mba", "\\bms\\b", "\\bba\\b",
  "bsc", "ba\\b", "program", "jurusan", "prodi",
  "degree in", "study", "studying",
];

function matchField(normInput: string): ParsedField {
  // Gate: require explicit program / degree context. Tally submissions
  // that only carry "University, Country" never trigger this and stay
  // honestly "unclear".
  const hasProgramContext = PROGRAM_KEYWORDS.some((k) => new RegExp(wb(k), "i").test(normInput));
  if (!hasProgramContext) return "unclear";

  const hasStem = STEM_KEYWORDS.some((k) => new RegExp(wb(k), "i").test(normInput));
  const hasBiz = BUSINESS_KEYWORDS.some((k) => new RegExp(wb(k), "i").test(normInput));
  if (hasStem && !hasBiz) return "STEM";
  if (hasBiz && !hasStem) return "Business";
  if (hasStem && hasBiz) return "Business"; // ambiguous → Business (MBA-style overlap)
  return "unclear";
}

function matchCampus(normInput: string): CampusAlias | null {
  const hits: { alias: CampusAlias; matchedPattern: string }[] = [];
  for (const alias of CAMPUS_ALIASES) {
    for (const p of alias.patterns) {
      if (new RegExp(wb(p), "i").test(normInput)) {
        hits.push({ alias, matchedPattern: p });
        break;
      }
    }
  }
  if (hits.length === 0) return null;
  // Prefer the alias whose matched pattern is longest (most specific).
  hits.sort((a, b) => b.matchedPattern.length - a.matchedPattern.length);
  return hits[0].alias;
}

function buildReason(args: {
  bucket: LeadBucket;
  parsedCountry: string | null;
  parsedCampus: string | null;
  parsedField: ParsedField;
  hasCountryMentor: boolean;
  isCampusPartner: boolean | null;
  input: string;
}): string {
  const { bucket, parsedCountry, parsedCampus, parsedField, hasCountryMentor, isCampusPartner, input } = args;
  if (bucket === "unclassified") {
    return `Country unclear from "${input}" — manual review needed`;
  }
  const parts: string[] = [];
  parts.push(`${parsedCountry} (${hasCountryMentor ? "mentor available" : "no mentor"})`);
  if (parsedCampus) {
    parts.push(`${parsedCampus}${isCampusPartner === true ? " (partner)" : " (not in partner list)"}`);
  } else {
    parts.push("no specific campus parsed");
  }
  parts.push(`field: ${parsedField}`);
  return parts.join(", ") + ` → Bucket ${bucket}`;
}

export const _internals = {
  CAMPUS_ALIASES,
  COUNTRY_KEYWORDS,
  STEM_KEYWORDS,
  BUSINESS_KEYWORDS,
  normalize,
};
