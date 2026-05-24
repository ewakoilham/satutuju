import type { LeadBucket, ParsedField } from "./types";
import UNIVERSITIES_JSON from "@/data/universities.json";

/** A mentor entry with at minimum a country — accepts both the seed type
 *  (src/lib/mentors.ts) and the merged runtime type. */
interface MentorLike {
  country?: string | null;
}

/** Shape of one row in src/data/universities.json. EVERY row is a real
 *  partner — they all pay commission via AECC. `degreeLevel` is the
 *  partner's program scope ("All" = no restriction; everything else
 *  carries forward as `partnerProgramScope`). Phase 12. */
interface UniversityRow {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
}
const UNIVERSITIES = UNIVERSITIES_JSON as readonly UniversityRow[];

export interface BucketResult {
  bucket: LeadBucket;
  reason: string;
  parsedCountry: string | null;
  parsedCampus: string | null;
  parsedField: ParsedField;
  isCampusPartner: boolean | null;
  hasCountryMentor: boolean;
  /** Phase 12 — partner's program scope (Cocoro="English Language",
   *  Kudan="All", etc.) when the parsed campus is in universities.json.
   *  `null` when scope = "All" (admin doesn't need a restriction warning)
   *  OR when no partner matched. */
  partnerProgramScope: string | null;
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

/**
 * Phase 12: partner status is now sourced exclusively from
 * `src/data/universities.json`. CAMPUS_ALIASES is purely a curated
 * name/country detector — whether a matched alias is also a partner
 * is decided AFTER the match by looking up the canonical name in
 * `UNIVERSITIES`. The `isPartner` field on this interface is gone.
 */
interface CampusAlias {
  canonical: string;
  country: string;
  patterns: string[]; // regex source strings, word-boundary handled by matcher
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
  // Phase 14: applicants commonly write reversed word order ("Edinburgh
  // University, UK") for these "University of X" unis. The `\bX uni\b`
  // pattern alone misses these because there's no word boundary between
  // `uni` and `versity`. We accept both orders explicitly here as belt-
  // and-suspenders alongside the token-set fallback in matchPartnerByName.
  { canonical: "University of Edinburgh",       country: "United Kingdom",             patterns: ["university of edinburgh", "edinburgh university", "edinburgh uni"] },
  { canonical: "University of Glasgow",         country: "United Kingdom",             patterns: ["university of glasgow", "glasgow university", "glasgow uni"] },
  { canonical: "University of Bristol",         country: "United Kingdom",             patterns: ["university of bristol", "bristol university", "bristol uni"] },
  { canonical: "University of Leeds",           country: "United Kingdom",             patterns: ["university of leeds", "leeds university", "leeds uni"] },
  { canonical: "University of Sheffield",       country: "United Kingdom",             patterns: ["university of sheffield", "sheffield university", "sheffield uni"] },
  { canonical: "University of Birmingham",      country: "United Kingdom",             patterns: ["university of birmingham", "birmingham university", "birmingham uni"] },
  { canonical: "University of Nottingham",      country: "United Kingdom",             patterns: ["university of nottingham", "nottingham university", "nottingham uni"] },
  { canonical: "Durham University",             country: "United Kingdom",             patterns: ["durham"] },
  { canonical: "University of Bath",            country: "United Kingdom",             patterns: ["university of bath", "bath university", "bath uni"] },
  { canonical: "Queen Mary University of London", country: "United Kingdom",           patterns: ["queen mary", "qmul"] },
  { canonical: "University of St Andrews",      country: "United Kingdom",             patterns: ["st andrews", "st\\. andrews"] },
  { canonical: "Lancaster University",          country: "United Kingdom",             patterns: ["lancaster"] },
  { canonical: "University of Southampton",     country: "United Kingdom",             patterns: ["southampton"] },
  { canonical: "University of Exeter",          country: "United Kingdom",             patterns: ["exeter"] },
  { canonical: "University of York",            country: "United Kingdom",             patterns: ["university of york", "york university", "york uni"] },

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
  // Canonical matches the universities.json row exactly so PARTNER_LOOKUP
  // catches abbrev inputs ("NUS, Singapore") as well as full-name inputs.
  { canonical: "National University of Singapore", country: "Singapore",   patterns: ["nus\\b", "national university of singapore"] },
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
  // Non-partner Japanese unis kept for country disambiguation:
  { canonical: "University of Tokyo",           country: "Japan",          patterns: ["university of tokyo", "todai", "u-tokyo"] },
  { canonical: "Kyoto University",              country: "Japan",          patterns: ["kyoto university"] },
  { canonical: "Osaka University",              country: "Japan",          patterns: ["osaka university"] },
  { canonical: "Waseda University",             country: "Japan",          patterns: ["waseda"] },
  { canonical: "Keio University",               country: "Japan",          patterns: ["keio"] },
  // Japan PARTNERS (rows present in universities.json) — adding
  // aliases here so the curated matcher picks them up before falling
  // back to the universities.json full scan. Canonical names match
  // the JSON exactly (case-sensitive equality is used by PARTNER_LOOKUP).
  { canonical: "TOKYO COCORO JAPANESE LANGUAGE SCHOOL", country: "Japan",  patterns: ["tokyo cocoro", "cocoro"] },
  { canonical: "KUDAN INSTITUTE OF JAPANESE LANGUAGE & CULTURE", country: "Japan", patterns: ["kudan institute", "kudan"] },
  { canonical: "KYOTO JAPANESE LANGUAGE SCHOOL", country: "Japan",         patterns: ["kyoto japanese language school"] },
  { canonical: "NIPPON ACADEMY",                country: "Japan",          patterns: ["nippon academy"] },
  { canonical: "KOKUSAI EISAI GAKUEN",          country: "Japan",          patterns: ["kokusai eisai", "kokusai eisai gakuen"] },
  { canonical: "AO INTERNATIONAL SCHOOL, JAPAN (LANGUAGE SCHOOL)", country: "Japan", patterns: ["ao international school"] },
  { canonical: "international College of Liberal Arts, iCLA Japan", country: "Japan", patterns: ["icla", "international college of liberal arts"] },

  // ── South Korea ──────────────────────────────────────────────────────────
  { canonical: "Seoul National University",     country: "South Korea",    patterns: ["seoul national", "snu\\b"] },
  { canonical: "KAIST",                         country: "South Korea",    patterns: ["kaist"] },
  { canonical: "POSTECH",                       country: "South Korea",    patterns: ["postech"] },
  { canonical: "Yonsei University",             country: "South Korea",    patterns: ["yonsei"] },
  { canonical: "Korea University",              country: "South Korea",    patterns: ["korea university"] },

  // ── Italy (country disambiguator only — no partner network here yet) ────
  // These entries help classifyLead route the lead to Italy (and therefore
  // bucket D), but do NOT mark the campus as a Satu Tuju partner.
  // Italy entries — used purely for country disambiguation. None are
  // in universities.json so they automatically resolve to non-partner.
  { canonical: "University of Ferrara",         country: "Italy",          patterns: ["ferrara"] },
  { canonical: "Bocconi University",            country: "Italy",          patterns: ["bocconi"] },
  { canonical: "Politecnico di Milano",         country: "Italy",          patterns: ["politecnico di milano", "polimi"] },
  { canonical: "University of Bologna",         country: "Italy",          patterns: ["university of bologna", "unibo"] },
];

// ──────────────────────────────────────────────────────────────────────────
// Partner lookup — Phase 12 single source of truth.
//
// universities.json holds every real partner (each row pays commission
// via the AECC agency). When the curated CAMPUS_ALIASES matcher returns
// a canonical name, we look it up here to decide isPartner + scope.
//
// PARTNER_LOOKUP: case-insensitive canonical → { scope }
// PARTNER_NAMES_SORTED: full-text scan fallback for unis that don't
//   have a curated CAMPUS_ALIASES entry (most of the 3500+ list).
//   Pre-sorted by length-desc so the first substring hit is the most
//   specific match.
// ──────────────────────────────────────────────────────────────────────────

interface PartnerEntry { canonical: string; country: string; scope: string | null }

/** Normalize for case-insensitive matching against canonical names. */
function partnerKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Map `degreeLevel` → scope shown to admin. "All" is the no-restriction
 *  marker and folds to null so the UI doesn't warn unnecessarily. */
function deriveScope(degreeLevel: string | undefined | null): string | null {
  if (!degreeLevel) return null;
  const trimmed = degreeLevel.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "all") return null;
  return trimmed;
}

const PARTNER_LOOKUP: Map<string, PartnerEntry> = (() => {
  const m = new Map<string, PartnerEntry>();
  for (const u of UNIVERSITIES) {
    const key = partnerKey(u.name);
    m.set(key, { canonical: u.name, country: u.country, scope: deriveScope(u.degreeLevel) });
  }
  return m;
})();

/**
 * universities.json has a handful of garbage rows whose name is a
 * single generic word ("College", "London", "Academy", "Bridge", …).
 * These false-match almost any lead input as substrings, so we skip
 * them entirely from the fallback matcher. New garbage rows added
 * later automatically get filtered if their name has ≤1 distinctive
 * word or is too short.
 */
function isUsableForFallbackMatch(normName: string): boolean {
  if (normName.length < 10) return false;
  // Must contain at least 2 distinct tokens (≥4 chars each) — single-
  // word names like "London", "Academy" don't qualify.
  const tokens = normName.split(/\s+/).filter((t) => t.length >= 4);
  return tokens.length >= 2;
}

/** Partner names sorted longest-first for the substring-scan fallback.
 *  Stores both the normalized form (for matching) and the original row.
 *  Skips garbage rows (see isUsableForFallbackMatch). */
const PARTNER_NAMES_SORTED: Array<{ norm: string; row: PartnerEntry }> = (() => {
  const list: Array<{ norm: string; row: PartnerEntry }> = [];
  for (const [, row] of PARTNER_LOOKUP) {
    const norm = normalize(row.canonical);
    if (isUsableForFallbackMatch(norm)) list.push({ norm, row });
  }
  list.sort((a, b) => b.norm.length - a.norm.length);
  return list;
})();

/** Filler words to ignore when comparing token sets. Keep this list
 *  short and conservative — anything left in is treated as a *required*
 *  token of the canonical name. */
const TOKEN_SET_STOPWORDS = new Set([
  "of", "the", "and", "for", "at", "in", "on", "to", "a", "an", "de", "le", "la",
]);

/** Phase 14 token-set fallback for partner matching. Handles word-order
 *  variation that the contiguous-substring scan can't: e.g. applicant
 *  writes "Edinburgh University, UK" but the canonical row is
 *  "University of Edinburgh".
 *
 *  Rule: ALL non-stopword tokens of the canonical must appear as word
 *  tokens in the input. We require ≥ 2 meaningful tokens so noise rows
 *  like "London College" can't false-match an input like "Cardiff
 *  University, London". The candidate with the most matching tokens
 *  wins (longest canonical breaks ties). */
function tokenSetMatchPartner(normInput: string): PartnerEntry | null {
  const inputTokens = new Set(normInput.split(/\s+/).filter(Boolean));
  let best: { row: PartnerEntry; tokenCount: number; nameLength: number } | null = null;
  for (const { norm, row } of PARTNER_NAMES_SORTED) {
    const tokens = norm.split(/\s+/).filter(Boolean);
    const meaningful = tokens.filter((t) => !TOKEN_SET_STOPWORDS.has(t));
    if (meaningful.length < 2) continue;
    if (!meaningful.every((t) => inputTokens.has(t))) continue;
    if (
      !best ||
      meaningful.length > best.tokenCount ||
      (meaningful.length === best.tokenCount && norm.length > best.nameLength)
    ) {
      best = { row, tokenCount: meaningful.length, nameLength: norm.length };
    }
  }
  return best?.row ?? null;
}

/** Find a universities.json partner whose full name appears (word-
 *  boundary anchored) inside the normalized lead input. Returns the
 *  longest match (most specific). Used as a fallback when CAMPUS_ALIASES
 *  doesn't match.
 *
 *  Phase 14: falls through to a token-set match when the contiguous-
 *  substring scan misses, so word-order variations ("Edinburgh
 *  University, UK" vs canonical "University of Edinburgh") still land. */
function matchPartnerByName(normInput: string): PartnerEntry | null {
  for (const { norm, row } of PARTNER_NAMES_SORTED) {
    // Word-boundary check: surround partner name with spaces and look
    // for the surrounded form in the padded normInput. Both ends MUST
    // sit at a word boundary so we don't match "london" as substring
    // of "london england".
    if (normInput.includes(` ${norm} `)) return row;
  }
  return tokenSetMatchPartner(normInput);
}

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
      partnerProgramScope: null,
    };
  }

  // Step 1+3: match a specific campus from the curated alias list.
  const campusMatch = matchCampus(normInput);
  let parsedCampus = campusMatch?.canonical ?? null;
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
      partnerProgramScope: null,
    };
  }

  // Step 2: field
  const parsedField = matchField(normInput);

  // Step 4: cross-reference partner status against universities.json.
  // First try by canonical name (from curated alias match), then fall
  // back to a substring + token-set scan over universities.json for
  // partners not yet in CAMPUS_ALIASES.
  //
  // Phase 14 typo handling: applicants sometimes spell "University" the
  // Bahasa way ("Universitas of Edinburgh"). When a clearly-foreign
  // country signal landed (parsedCountry set to something other than
  // Indonesia), retry campus + partner matching with the typo
  // normalized. Gated on non-Indonesia so genuine "Universitas
  // Indonesia" inputs stay domestic (they short-circuit earlier via
  // isDomesticIndonesia anyway, but the guard is belt-and-suspenders).
  const hasUniversitasTypo =
    parsedCountry !== null &&
    parsedCountry !== "Indonesia" &&
    /\buniversitas\b/.test(normInput);
  const matchInput = hasUniversitasTypo
    ? normInput.replace(/\buniversitas\b/g, "university")
    : normInput;
  if (!parsedCampus && hasUniversitasTypo) {
    const retry = matchCampus(matchInput);
    if (retry) parsedCampus = retry.canonical;
  }

  let partnerEntry: PartnerEntry | null = null;
  if (parsedCampus) {
    partnerEntry = PARTNER_LOOKUP.get(partnerKey(parsedCampus)) ?? null;
  }
  if (!partnerEntry) {
    const scanned = matchPartnerByName(matchInput);
    if (scanned) {
      partnerEntry = scanned;
      // Promote the JSON match to parsedCampus/parsedCountry if no
      // curated alias landed earlier.
      if (!parsedCampus) parsedCampus = scanned.canonical;
      if (!parsedCountry) parsedCountry = scanned.country;
    }
  }

  const hasCountryMentor =
    parsedCountry !== null && mentors.some((m) => (m.country ?? "") === parsedCountry);
  // Tri-state semantics:
  //   true  → matched a row in universities.json (real partner)
  //   false → campus parsed but not a partner (country disambiguator only)
  //   null  → no specific campus parsed
  const isCampusPartner: boolean | null =
    partnerEntry !== null ? true : (parsedCampus !== null ? false : null);
  const partnerProgramScope: string | null = partnerEntry?.scope ?? null;

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
    partnerProgramScope,
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
    partnerProgramScope,
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
  partnerProgramScope: string | null;
  input: string;
}): string {
  const { bucket, parsedCountry, parsedCampus, parsedField, hasCountryMentor, isCampusPartner, partnerProgramScope, input } = args;
  if (bucket === "unclassified") {
    return `Country unclear from "${input}" — manual review needed`;
  }
  const parts: string[] = [];
  parts.push(`${parsedCountry} (${hasCountryMentor ? "mentor available" : "no mentor"})`);
  if (parsedCampus) {
    const partnerTag = isCampusPartner === true
      ? (partnerProgramScope ? ` (partner · hanya ${partnerProgramScope})` : " (partner)")
      : " (not in partner list)";
    parts.push(`${parsedCampus}${partnerTag}`);
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
