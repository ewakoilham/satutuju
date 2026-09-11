import "server-only";

import { supabase } from "@/lib/supabase";
import { classifyLead } from "@/lib/leads/bucketing";
import { newLeadId, newStageHistoryId } from "@/lib/leads/ids";
import { completeStepByTrigger, seedStepStatusesForLead } from "@/lib/leads/step-helpers";
import { MENTORS } from "@/lib/mentors";
import {
  listSubmissions,
  enrichSubmission,
  pickField,
  pickFieldByType,
  type EnrichedSubmission,
} from "@/lib/integrations/tally";

/**
 * Pull all submissions from Tally and upsert them into the Lead table.
 *
 * Form 9qO65Q field mapping (verified May 2026):
 *   - First Name + Last Name      → Lead.name (concatenated)
 *   - Email                       → Lead.email
 *   - Whatsapp Number             → Lead.whatsappNumber
 *   - University                  → first half of targetCampusAndProgram
 *   - Country                     → second half of targetCampusAndProgram
 *   - MULTIPLE_CHOICE (untitled)  → fundingPlan
 *
 * Idempotent: keyed by tallySubmissionId (the submission's `id`).
 * Re-running is safe.
 */

export interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** Names of newly created leads — lets the cron send one digest email. */
  createdNames: string[];
}

function normalizeFunding(raw: string | null): string {
  if (!raw) return "self_funded";
  const v = raw.toLowerCase();
  // Tally's MULTIPLE_CHOICE for funding typically: "Full scholarship",
  // "Partial scholarship", "Self-funded", "Beasiswa", "Mandiri".
  if (v.includes("full scholarship") || v.includes("beasiswa penuh")) return "scholarship";
  if (v.includes("scholarship") || v.includes("beasiswa")) {
    return v.includes("partial") || v.includes("sebagian") ? "partial" : "scholarship";
  }
  if (v.includes("partial") || v.includes("kombinasi") || v.includes("sebagian")) return "partial";
  if (v.includes("mandiri") || v.includes("self")) return "self_funded";
  return raw.slice(0, 50);
}

function mentorsForClassifier() {
  return MENTORS.map((m) => ({ country: m.country ?? null }));
}

interface ParsedFields {
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  university: string | null;
  country: string | null;
  fundingRaw: string | null;
  // Phase — additional profile fields the Tally form grew over time
  // (not present when this file's original field mapping was written).
  statusLulus: string | null;
  kampusStudiS1: string | null;
  bidangPekerjaan: string | null;
  lamaPengalamanKerja: string | null;
  linkedinOrCvLink: string | null;
  cvUploadUrl: string | null;
  cvUploadFileName: string | null;
  masterStudyPlan: string | null;
  studyPlanEssay: string | null;
  additionalNotes: string | null;
  referralCode: string | null;
  consentGiven: boolean | null;
}

/** Titles this form is known to use for OTHER fields, checked so the
 *  first-name positional fallback below can't accidentally grab one of
 *  them instead of the actual name field. */
const KNOWN_NON_NAME_TITLES = [
  "last name", "nama belakang", "email", "whatsapp", "country", "negara",
  "target university", "target kampus", "status lulus", "kampus studi",
  "bidang pekerjaan", "pengalaman kerja", "linkedin", "referral",
];

function parseSubmission(sub: EnrichedSubmission): ParsedFields {
  const lastName = pickField(sub, ["last name", "nama belakang"]);

  // First name: alias match first. Tally form owners rename questions
  // freely — this one drifted from "First Name" to "Please enter your
  // information below" without any code change, silently dropping the
  // first name off ~140 leads. Title strings will keep drifting, so
  // fall back to POSITION: the first INPUT_TEXT question in the form
  // that isn't one of the other fields we already recognize by title.
  // Position in the form is far more stable than a label the operator
  // can rename in Tally's UI at any time.
  let firstName = pickField(sub, ["first name", "nama depan"]);
  if (!firstName) {
    const candidate = sub.ordered.find((o) => {
      if (o.type !== "INPUT_TEXT" || !o.value) return false;
      const title = (o.title ?? "").toLowerCase();
      return !KNOWN_NON_NAME_TITLES.some((known) => title.includes(known));
    });
    firstName = candidate?.value ?? null;
  }
  // Concatenate name; if only one present, use that.
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  // Master study plan / funding are MULTIPLE_CHOICE blocks; Tally
  // sometimes ships them without a stable title, so fall back to
  // "first/second multi-choice answer in the submission" when the title
  // lookup misses. Collected in form order so the fallback is stable.
  const multipleChoiceValues = sub.ordered
    .filter((o) => o.type === "MULTIPLE_CHOICE" && o.value)
    .map((o) => o.value as string);

  const fileEntry = sub.ordered.find((o) => o.type === "FILE_UPLOAD");
  const fileAnswer = Array.isArray(fileEntry?.rawAnswer) ? fileEntry!.rawAnswer[0] : null;
  const cvFile =
    fileAnswer && typeof fileAnswer === "object" && "url" in fileAnswer
      ? (fileAnswer as { url: string; name: string })
      : null;

  const consentRaw = pickField(sub, ["bersedia", "consent", "setuju"]);

  return {
    name,
    email: pickField(sub, ["email", "email address", "alamat email"]),
    whatsapp: pickField(sub, [
      "whatsapp number", "whatsapp", "phone", "no whatsapp",
      "nomor whatsapp", "no hp", "phone number",
    ]),
    // Phase 12/13 fix: "kampus" alone used to be in this list. The form
    // later grew a "Kampus Studi S1" question (undergrad campus — NOT
    // the target), and since that title also contains "kampus", the
    // substring matcher was silently returning the applicant's OLD
    // campus as their TARGET whenever the real target field was left
    // blank (it's optional). Dropped the bare "kampus" alias; "target
    // kampus" stays since it can't collide with "Kampus Studi S1".
    university: pickField(sub, [
      "university", "target university", "target kampus", "campus", "universitas",
    ]),
    country: pickField(sub, ["country", "negara", "target country"]),
    fundingRaw:
      pickField(sub, ["funding", "funding plan", "rencana pendanaan", "rencana pembiayaan", "pembiayaan", "scholarship"])
      ?? multipleChoiceValues[0]
      ?? null,
    statusLulus: pickField(sub, ["status lulus"]),
    kampusStudiS1: pickField(sub, ["kampus studi s1", "kampus studi"]),
    bidangPekerjaan: pickField(sub, ["bidang pekerjaan"]),
    lamaPengalamanKerja: pickField(sub, ["lama pengalaman kerja", "pengalaman kerja"]),
    linkedinOrCvLink: pickField(sub, ["linkedin"]),
    cvUploadUrl: cvFile?.url ?? null,
    cvUploadFileName: cvFile?.name ?? null,
    masterStudyPlan: pickField(sub, ["master study plan", "rencana studi master"]) ?? multipleChoiceValues[1] ?? null,
    // The essay is a question with no title at all ("null") — grab the
    // first untitled TEXTAREA. The (separately titled) "Tell us what we
    // need to know from you" field is captured as additionalNotes below.
    studyPlanEssay: (() => {
      const entry = sub.ordered.find((o) => o.type === "TEXTAREA" && !o.title && o.value);
      return entry?.value ?? null;
    })(),
    additionalNotes: pickField(sub, ["tell us what we need to know"]),
    referralCode: pickField(sub, ["referral"]),
    consentGiven: consentRaw ? /ya|yes|bersedia|setuju/i.test(consentRaw) : null,
  };
}

/**
 * Upsert one submission. The caller supplies `existingLeadId` (from a
 * batched existence check) so we don't pay a per-row SELECT here — pass
 * `null` for a brand-new submission, or the existing Lead id to update.
 */
async function ingestSubmission(
  sub: EnrichedSubmission,
  existingLeadId: string | null,
): Promise<
  | { action: "created"; leadId: string; leadName: string }
  | { action: "updated"; leadId: string }
  | { action: "skipped"; reason: string }
  | { action: "error"; error: string }
> {
  const fields = parseSubmission(sub);
  if (!fields.name || !fields.email) {
    return {
      action: "skipped",
      reason: `missing required (name=${!!fields.name}, email=${!!fields.email})`,
    };
  }

  // Compose targetCampusAndProgram from University + Country. Either
  // alone is enough for bucketing, but combining gives the classifier
  // both signals.
  const targetParts = [fields.university, fields.country].filter(Boolean);
  const target = targetParts.length > 0 ? targetParts.join(", ") : "(target tidak diisi)";

  const classification = classifyLead(target, mentorsForClassifier());
  const now = new Date().toISOString();
  const submittedAt = sub.submittedAt || now;
  const fundingPlan = normalizeFunding(fields.fundingRaw);
  const tallySubmissionId = sub.id;

  // NOTE: deliberately does NOT include `stage` — that's pipeline
  // progress an admin/mentor owns, set once at insert below and never
  // touched by a re-sync (a re-sync must never silently move someone's
  // lead backward/forward in the pipeline).
  const baseFields = {
    name: fields.name,
    email: fields.email,
    whatsappNumber: fields.whatsapp,
    targetCampusAndProgram: target,
    fundingPlan,
    bucket: classification.bucket,
    bucketReason: classification.reason,
    parsedCountry: classification.parsedCountry,
    parsedCampus: classification.parsedCampus,
    parsedField: classification.parsedField,
    isCampusPartner: classification.isCampusPartner,
    hasCountryMentor: classification.hasCountryMentor,
    partnerProgramScope: classification.partnerProgramScope,
    statusLulus: fields.statusLulus,
    kampusStudiS1: fields.kampusStudiS1,
    bidangPekerjaan: fields.bidangPekerjaan,
    lamaPengalamanKerja: fields.lamaPengalamanKerja,
    linkedinOrCvLink: fields.linkedinOrCvLink,
    cvUploadUrl: fields.cvUploadUrl,
    cvUploadFileName: fields.cvUploadFileName,
    masterStudyPlan: fields.masterStudyPlan,
    studyPlanEssay: fields.studyPlanEssay,
    additionalNotes: fields.additionalNotes,
    referralCode: fields.referralCode,
    consentGiven: fields.consentGiven,
    updatedAt: now,
  };

  if (existingLeadId) {
    const { error: updErr } = await supabase
      .from("Lead")
      .update(baseFields)
      .eq("id", existingLeadId);
    if (updErr) return { action: "error", error: updErr.message };
    return { action: "updated", leadId: existingLeadId };
  }

  const id = newLeadId();
  const { error: insErr } = await supabase
    .from("Lead")
    .insert({
      id,
      ...baseFields,
      submittedAt,
      tallySubmissionId,
      stage: "new",
      createdAt: now,
    });
  if (insErr) return { action: "error", error: insErr.message };

  await supabase.from("LeadStageHistory").insert({
    id: newStageHistoryId(),
    leadId: id,
    fromStage: null,
    toStage: "new",
    changedBy: "tally-sync",
    note: classification.reason,
    createdAt: now,
  });

  const seedResult = await seedStepStatusesForLead(id);
  if (!seedResult.ok) {
    console.error(`[tally-sync] step seed failed for ${id}: ${seedResult.error}`);
  }

  // Auto-complete the "Klasifikasi otomatis" pipeline step — every lead
  // is fully classified at insert (bucket + parsedCountry + parsedField).
  await completeStepByTrigger(id, "classified").catch((e) => {
    console.error(`[tally-sync] classified-trigger failed for ${id}:`, e);
  });

  return { action: "created", leadId: id, leadName: fields.name };
}

/**
 * Pull submissions from Tally and upsert them into the Lead table.
 *
 * Tally returns submissions newest-first. In `incremental` mode (used by
 * the every-N-minutes cron) we walk pages from the top and STOP at the
 * first submission already in the DB — everything older is already
 * ingested, so there's nothing to do. This turns a steady-state run into
 * a single Tally page + a single batched existence check (no work when
 * nothing new came in), instead of re-fetching and re-writing every lead.
 *
 * In full mode (the admin "Sync" button) we walk every page and re-upsert
 * all rows — useful for back-filling re-classification after the matching
 * logic changes. Either way the per-page existence check is a single
 * batched `.in(...)` query rather than one SELECT per submission.
 */
export async function syncTallySubmissions(
  opts: { incremental?: boolean } = {},
): Promise<SyncResult> {
  const incremental = opts.incremental ?? false;
  const result: SyncResult = { total: 0, created: 0, updated: 0, skipped: 0, errors: [], createdNames: [] };

  const limit = 50;
  const MAX_PAGES = 50;
  let page = 1;
  let stop = false;

  while (page <= MAX_PAGES && !stop) {
    let listing;
    try {
      listing = await listSubmissions({ page, limit });
    } catch (err) {
      result.errors.push(`page ${page}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
    if (listing.submissions.length === 0) break;

    const enriched = listing.submissions.map((s) => enrichSubmission(s, listing.questions));
    result.total += enriched.length;

    // Batched existence check: one query for the whole page instead of
    // one SELECT per submission.
    const ids = enriched.map((e) => e.id);
    const { data: existingRows, error: existErr } = await supabase
      .from("Lead")
      .select("id, tallySubmissionId")
      .in("tallySubmissionId", ids);
    if (existErr) {
      result.errors.push(`page ${page} existence check: ${existErr.message}`);
      break;
    }
    const existingByTally = new Map<string, string>();
    for (const row of existingRows ?? []) {
      existingByTally.set(row.tallySubmissionId as string, row.id as string);
    }

    for (const sub of enriched) {
      const existingLeadId = existingByTally.get(sub.id) ?? null;

      // Incremental stop condition: the first already-known submission
      // means every later (older) submission is known too.
      if (incremental && existingLeadId) {
        result.skipped++;
        stop = true;
        break;
      }

      try {
        const r = await ingestSubmission(sub, existingLeadId);
        switch (r.action) {
          case "created": result.created++; result.createdNames.push(r.leadName); break;
          case "updated": result.updated++; break;
          case "skipped": result.skipped++; break;
          case "error":   result.errors.push(`${sub.id}: ${r.error}`); break;
        }
      } catch (err) {
        result.errors.push(`${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (listing.submissions.length < limit) break;
    if (listing.hasMore === false) break;
    page++;
  }

  return result;
}
