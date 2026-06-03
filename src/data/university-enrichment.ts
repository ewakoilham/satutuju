/** Curated enrichment for flagship partner universities.
 *
 *  Two kinds of *verifiable* data only:
 *   - `logo`  — a real asset that ships in /public/universities.
 *   - `qsRank`— QS World University Rankings 2025, included ONLY for globally
 *               flagship institutions whose rank is stable and widely cited.
 *
 *  This is a deliberately small, hand-maintained subset — NOT every one of the
 *  3,524 directory rows. We intentionally do NOT carry tuition / IELTS /
 *  intake deadlines: those vary by program and year and have no reliable
 *  source in the dataset, so inventing them would mislead mentors advising
 *  students. Add/correct entries here as a real data source becomes available.
 */

export interface UniEnrichment {
  /** Lowercased name substrings that identify this institution in the directory. */
  match: string[];
  /** Path under /public. */
  logo: string;
  /** QS World University Rankings 2025 (omitted where not confidently known). */
  qsRank?: number;
  location?: string;
}

export const UNI_ENRICHMENT: UniEnrichment[] = [
  // ── United Kingdom ──────────────────────────────────────────
  { match: ["imperial college"], logo: "/universities/imperial.svg", qsRank: 2, location: "London, UK" },
  { match: ["university of oxford", "oxford university"], logo: "/universities/oxford.svg", qsRank: 3, location: "Oxford, UK" },
  { match: ["university of cambridge", "cambridge university"], logo: "/universities/cambridge.png", qsRank: 5, location: "Cambridge, UK" },
  { match: ["university of edinburgh"], logo: "/universities/edinburgh.svg", qsRank: 27, location: "Edinburgh, UK" },
  { match: ["university of manchester"], logo: "/universities/manchester.svg", qsRank: 34, location: "Manchester, UK" },
  { match: ["king's college london", "kings college london", "king s college london"], logo: "/universities/kings-college-london.svg", qsRank: 40, location: "London, UK" },
  { match: ["london school of economics"], logo: "/universities/lse.svg", qsRank: 50, location: "London, UK" },
  { match: ["university of bristol"], logo: "/universities/bristol.svg", location: "Bristol, UK" },
  { match: ["university of warwick"], logo: "/universities/warwick.svg", location: "Coventry, UK" },
  { match: ["university of glasgow"], logo: "/universities/glasgow.svg", location: "Glasgow, UK" },
  { match: ["university of birmingham"], logo: "/universities/birmingham.png", location: "Birmingham, UK" },
  { match: ["university of leeds"], logo: "/universities/leeds.svg", location: "Leeds, UK" },
  { match: ["durham university", "university of durham"], logo: "/universities/durham.jpg", location: "Durham, UK" },
  { match: ["university of sheffield"], logo: "/universities/sheffield.svg", location: "Sheffield, UK" },
  { match: ["newcastle university"], logo: "/universities/newcastle.svg", location: "Newcastle, UK" },
  { match: ["university of liverpool"], logo: "/universities/liverpool.svg", location: "Liverpool, UK" },
  { match: ["cardiff university"], logo: "/universities/cardiff.svg", location: "Cardiff, UK" },
  { match: ["university of exeter"], logo: "/universities/exeter.svg", location: "Exeter, UK" },
  { match: ["university of york"], logo: "/universities/york.svg", location: "York, UK" },
  { match: ["university of nottingham"], logo: "/universities/nottingham.png", location: "Nottingham, UK" },
  { match: ["university of southampton"], logo: "/universities/southampton.svg", location: "Southampton, UK" },

  // ── Australia / New Zealand ─────────────────────────────────
  { match: ["university of melbourne"], logo: "/universities/melbourne.svg", qsRank: 13, location: "Melbourne, AU" },
  { match: ["university of sydney"], logo: "/universities/sydney.svg", qsRank: 18, location: "Sydney, AU" },
  { match: ["university of new south wales", "unsw"], logo: "/universities/unsw.jpg", qsRank: 19, location: "Sydney, AU" },
  { match: ["australian national university"], logo: "/universities/anu.png", qsRank: 30, location: "Canberra, AU" },
  { match: ["monash university"], logo: "/universities/monash.svg", qsRank: 37, location: "Melbourne, AU" },
  { match: ["university of auckland"], logo: "/universities/auckland.svg", qsRank: 65, location: "Auckland, NZ" },

  // ── North America ───────────────────────────────────────────
  { match: ["johns hopkins"], logo: "/universities/johns-hopkins.svg", qsRank: 28, location: "Baltimore, US" },
  { match: ["university of british columbia"], logo: "/universities/ubc.svg", qsRank: 38, location: "Vancouver, CA" },

  // ── Europe ──────────────────────────────────────────────────
  { match: ["aalto university"], logo: "/universities/aalto.png", qsRank: 116, location: "Espoo, FI" },
  { match: ["university college dublin"], logo: "/universities/ucd.svg", location: "Dublin, IE" },

  // ── Switzerland ─────────────────────────────────────────────
  { match: ["business and hotel management", "bhms"], logo: "/universities/bhms.jpg", location: "Lucerne, CH" },
];

/** Returns the enrichment whose match-substrings appear in the (lowercased)
 *  university name, or null. Specific substrings keep false positives low
 *  (e.g. "university of sydney" won't match "Western Sydney University"). */
export function enrichUniversity(name: string): UniEnrichment | null {
  const n = name.toLowerCase();
  for (const e of UNI_ENRICHMENT) {
    if (e.match.some((m) => n.includes(m))) return e;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════
   ESTIMATES (marked with * in the UI)

   The dataset has no tuition / English-test / intake fields, and there is
   no free authoritative feed that covers UK/AU/EU/Asia institutions. Those
   figures realistically only exist as country-level ranges. So instead of
   inventing per-university numbers, we surface honest *country + degree-level
   ballparks* and flag every one with a "*" + a disclaimer in the UI.

   Sources for the ranges (2025): Mastersportal, UniversityLiving, official
   university intl pages. Always verify on the institution's own site.
   ════════════════════════════════════════════════════════════════════ */

interface CountryEstimate {
  /** International tuition / year (postgraduate). */
  pg: string;
  /** International tuition / year (undergraduate). */
  ug: string;
  ielts: string;
  intake: string;
}

const COUNTRY_ESTIMATES: Record<string, CountryEstimate> = {
  Australia:     { pg: "A$ 32–55k",  ug: "A$ 28–45k",  ielts: "6.5", intake: "Feb · Jul" },
  "New Zealand": { pg: "NZ$ 30–45k", ug: "NZ$ 26–40k", ielts: "6.5", intake: "Feb · Jul" },
  UK:            { pg: "£ 18–30k",   ug: "£ 15–28k",   ielts: "6.5", intake: "Sep · Jan" },
  USA:           { pg: "US$ 25–55k", ug: "US$ 25–55k", ielts: "6.5–7.0", intake: "Aug · Jan" },
  Canada:        { pg: "C$ 20–40k",  ug: "C$ 18–35k",  ielts: "6.5", intake: "Sep · Jan" },
  Ireland:       { pg: "€ 12–25k",   ug: "€ 10–22k",   ielts: "6.5", intake: "Sep" },
  Germany:       { pg: "€ 0–20k",    ug: "€ 0–15k",    ielts: "6.5", intake: "Okt · Apr" },
  Netherlands:   { pg: "€ 15–20k",   ug: "€ 10–15k",   ielts: "6.5", intake: "Sep · Feb" },
  France:        { pg: "€ 4–20k",    ug: "€ 3–15k",    ielts: "6.5", intake: "Sep · Jan" },
  Singapore:     { pg: "S$ 30–55k",  ug: "S$ 30–50k",  ielts: "6.5", intake: "Aug · Jan" },
  "Hong Kong":   { pg: "HK$ 140–210k", ug: "HK$ 140–190k", ielts: "6.5", intake: "Sep · Jan" },
  Japan:         { pg: "¥ 0.5–1.5jt", ug: "¥ 0.5–1.2jt", ielts: "6.0–6.5", intake: "Apr · Sep" },
  "South Korea": { pg: "₩ 6–12jt",   ug: "₩ 5–10jt",   ielts: "6.0–6.5", intake: "Mar · Sep" },
  Switzerland:   { pg: "CHF 1.5–25k", ug: "CHF 1.5–20k", ielts: "6.5", intake: "Sep · Feb" },
};

export interface UniEstimate {
  tuition: string | null;
  ielts: string | null;
  intake: string | null;
}

/** Honest country + degree-level ballpark. Returns nulls for short programs
 *  (language / foundation / summer) where a year-tuition figure is misleading,
 *  and for countries we don't have a range for. UI must render these with "*". */
export function estimateUniStats(country: string, degreeLevel: string): UniEstimate {
  const c = COUNTRY_ESTIMATES[country];
  if (!c) return { tuition: null, ielts: null, intake: null };
  const isShort = /English|Foundation|Summer/i.test(degreeLevel);
  if (isShort) return { tuition: null, ielts: c.ielts, intake: c.intake };
  const tuition = degreeLevel === "Undergraduate" ? c.ug : c.pg;
  return { tuition, ielts: c.ielts, intake: c.intake };
}
