/** Document kind classifier for the per-session "Dokumen yang diperlukan"
 *  checklist.
 *
 *  Two kinds of documents flow through a session:
 *
 *    - "template"  → a program document WE produce (trackers, calendars,
 *                    shortlist worksheets, narrative/essay scaffolds, prep
 *                    notes). The mentee DOWNLOADS our template, fills it in,
 *                    then UPLOADS it back to the session.
 *
 *    - "personal"  → the mentee's own credentials the university requires
 *                    (CV, transcript/ijazah, passport, language scores,
 *                    certificates, recommendation letters). These come from
 *                    the mentee's side — UPLOAD only, no template.
 *
 *  The template download link is filled in later (per-name TEMPLATE_URLS).
 *  Until a real URL exists, a template item renders the same upload affordance
 *  as a personal one, plus a small "template program" tag so the distinction
 *  is visible even before files are wired up. The "Unduh template" button only
 *  appears once a URL is present.
 */

export type DocKind = "template" | "personal";

export interface DocSpec {
  kind: DocKind;
  /** Download URL for the program template. Empty until wired up. When set,
   *  the checklist row shows an "Unduh template" button. */
  templateUrl?: string;
}

/** Name patterns for PERSONAL documents (the mentee's own credentials).
 *  Anything that does NOT match these is treated as a program template. */
const PERSONAL_PATTERNS: RegExp[] = [
  /\bcv\b/i,
  /resume/i,
  /transcript|transkrip/i,
  /ijazah|diploma/i,
  /passport|paspor/i,
  /\bielts\b|\btoefl\b|\bgre\b|\bgmat\b/i,
  /language (test|score)/i,
  /certificate|sertifikat/i,
  /recommendation|rekomendasi|recommender/i,
  /recording|rekaman/i,
  /submission confirmation|confirmation|konfirmasi/i,
  /official/i, // "Transcript (official)"
];

/** Real template download links, keyed by the exact checklist label (trimmed).
 *  Populated as the program publishes each template. Anything not listed has
 *  no download button yet. */
const TEMPLATE_URLS: Record<string, string> = {
  // "Application tracker": "https://…",
  // "Deadline calendar": "https://…",
  // "University shortlist document": "https://…",
  // "Narrative core document": "https://…",
  // "ML/PS outline": "https://…",
};

/** Classify a checklist label into a document kind + optional template URL. */
export function classifyDoc(name: string): DocSpec {
  const label = name.trim();
  const isPersonal = PERSONAL_PATTERNS.some((re) => re.test(label));
  if (isPersonal) return { kind: "personal" };
  return { kind: "template", templateUrl: TEMPLATE_URLS[label] };
}
