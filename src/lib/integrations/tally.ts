import "server-only";

/**
 * Thin client for the Tally REST API.
 *
 * Docs: https://tally.so/help/developer-resources
 *
 * Auth: Bearer token (TALLY_API_KEY in env, get from
 * https://tally.so/settings/api).
 *
 * Real response shape (form 9qO65Q, verified May 2026):
 *   {
 *     page, limit, hasMore,
 *     totalNumberOfSubmissionsPerFilter: { all, completed, partial },
 *     questions: [{ id, type, title, ... }],
 *     submissions: [{
 *       id, formId, submittedAt, createdAt,
 *       responses: [{ questionId, answer }]
 *     }]
 *   }
 *
 * Note: `answer` is `string` for INPUT_*, `string[]` for MULTIPLE_CHOICE,
 * `null` if left blank.
 */

const TALLY_BASE = "https://api.tally.so";

/** Default form ID. Override with TALLY_FORM_ID env if you ever launch
 *  multiple intake forms. */
export const TALLY_FORM_ID = process.env.TALLY_FORM_ID || "9qO65Q";

/** A single question in the form schema. */
export interface TallyQuestion {
  id: string;
  type: string;          // "INPUT_TEXT" | "INPUT_EMAIL" | "MULTIPLE_CHOICE" | ...
  title: string | null;  // may be empty/null for some block types
}

/** A single answer inside a submission. */
export interface TallyResponse {
  questionId: string;
  answer: string | string[] | number | boolean | null;
}

/** A single submission row. */
export interface TallySubmission {
  id: string;
  formId: string;
  submittedAt: string;
  createdAt: string;
  responses: TallyResponse[];
  respondentId?: string;
  isCompleted?: boolean;
}

/** The list endpoint's full response. */
export interface TallyListResponse {
  page: number;
  limit: number;
  hasMore: boolean;
  totalNumberOfSubmissionsPerFilter?: {
    all: number;
    completed: number;
    partial: number;
  };
  questions: TallyQuestion[];
  submissions: TallySubmission[];
}

/** Submission joined with the question schema — what callers actually need. */
export interface EnrichedSubmission {
  id: string;
  formId: string;
  submittedAt: string;
  /** Map of question title (lowercased + trimmed) → answer string.
   *  Multi-choice answers are joined with " | "; null answers omitted. */
  byTitle: Record<string, string>;
  /** Map of question type → answer string. Useful when title is empty
   *  (e.g. MULTIPLE_CHOICE blocks without an explicit prompt). Returns
   *  the FIRST answer of that type. */
  byType: Record<string, string>;
  /** Full raw responses for debugging / unexpected layouts. */
  raw: TallySubmission;
}

function getApiKey(): string {
  const key = process.env.TALLY_API_KEY;
  if (!key) throw new Error("TALLY_API_KEY is not set in environment");
  return key;
}

/** Fetch one page of submissions. Tally returns 50 per page by default. */
export async function listSubmissions(opts: {
  formId?: string;
  page?: number;
  limit?: number;
}): Promise<TallyListResponse> {
  const formId = opts.formId || TALLY_FORM_ID;
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.limit) params.set("limit", String(opts.limit));

  const url = `${TALLY_BASE}/forms/${encodeURIComponent(formId)}/submissions${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tally API ${res.status} ${res.statusText}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as TallyListResponse;
  return {
    page: data.page ?? opts.page ?? 1,
    limit: data.limit ?? opts.limit ?? 50,
    hasMore: data.hasMore ?? false,
    totalNumberOfSubmissionsPerFilter: data.totalNumberOfSubmissionsPerFilter,
    questions: data.questions ?? [],
    submissions: data.submissions ?? [],
  };
}

/** Convert an answer (string | string[] | null) to a single human string. */
function answerToString(answer: TallyResponse["answer"]): string | null {
  if (answer === null || answer === undefined) return null;
  if (Array.isArray(answer)) {
    const joined = answer
      .map((x) => (x === null || x === undefined ? "" : String(x).trim()))
      .filter(Boolean)
      .join(" | ");
    return joined || null;
  }
  const s = String(answer).trim();
  return s || null;
}

/** Build a normalized view of one submission by joining with the question
 *  schema for the same form. */
export function enrichSubmission(
  submission: TallySubmission,
  questions: TallyQuestion[],
): EnrichedSubmission {
  const qById = new Map<string, TallyQuestion>();
  for (const q of questions) qById.set(q.id, q);

  const byTitle: Record<string, string> = {};
  const byType: Record<string, string> = {};

  for (const r of submission.responses ?? []) {
    const q = qById.get(r.questionId);
    if (!q) continue;
    const value = answerToString(r.answer);
    if (value === null) continue;

    if (q.title) {
      const key = q.title.toLowerCase().trim();
      if (!(key in byTitle)) byTitle[key] = value;
    }
    if (q.type) {
      if (!(q.type in byType)) byType[q.type] = value;
    }
  }

  return {
    id: submission.id,
    formId: submission.formId,
    submittedAt: submission.submittedAt || submission.createdAt,
    byTitle,
    byType,
    raw: submission,
  };
}

/** Paginate through ALL submissions for a form, returning enriched rows.
 *  Use sparingly — for ~150 leads, this is 3 round-trips. */
export async function fetchAllEnrichedSubmissions(formId?: string): Promise<EnrichedSubmission[]> {
  const all: EnrichedSubmission[] = [];
  const limit = 50;
  let page = 1;
  const MAX_PAGES = 50;

  while (page <= MAX_PAGES) {
    const data = await listSubmissions({ formId, page, limit });
    if (data.submissions.length === 0) break;

    for (const s of data.submissions) {
      all.push(enrichSubmission(s, data.questions));
    }

    if (data.submissions.length < limit) break;
    if (data.hasMore === false) break;
    page++;
  }
  return all;
}

/** Look up an answer by question title — tries each alias substring. */
export function pickField(
  sub: EnrichedSubmission,
  aliases: string[],
): string | null {
  for (const a of aliases) {
    const na = a.toLowerCase().trim();
    // exact title match first
    if (sub.byTitle[na]) return sub.byTitle[na];
    // substring fallback
    for (const [title, value] of Object.entries(sub.byTitle)) {
      if (title.includes(na)) return value;
    }
  }
  return null;
}

/** Look up answer by question type (e.g. MULTIPLE_CHOICE for funding
 *  question that has no title). */
export function pickFieldByType(
  sub: EnrichedSubmission,
  type: string,
): string | null {
  return sub.byType[type] ?? null;
}
