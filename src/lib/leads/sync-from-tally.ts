import "server-only";

import { supabase } from "@/lib/supabase";
import { classifyLead } from "@/lib/leads/bucketing";
import { newLeadId, newStageHistoryId } from "@/lib/leads/ids";
import { seedStepStatusesForLead } from "@/lib/leads/step-helpers";
import { MENTORS } from "@/lib/mentors";
import {
  fetchAllEnrichedSubmissions,
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
}

function parseSubmission(sub: EnrichedSubmission): ParsedFields {
  const firstName = pickField(sub, ["first name", "nama depan"]);
  const lastName = pickField(sub, ["last name", "nama belakang"]);
  // Concatenate name; if only one present, use that.
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;

  return {
    name,
    email: pickField(sub, ["email", "email address", "alamat email"]),
    whatsapp: pickField(sub, [
      "whatsapp number", "whatsapp", "phone", "no whatsapp",
      "nomor whatsapp", "no hp", "phone number",
    ]),
    university: pickField(sub, [
      "university", "target university", "kampus", "target kampus",
      "campus", "universitas",
    ]),
    country: pickField(sub, ["country", "negara", "target country"]),
    // Funding question is a MULTIPLE_CHOICE block without a stable title;
    // fall back to "first multi-choice answer in the submission".
    fundingRaw:
      pickField(sub, ["funding", "funding plan", "rencana pendanaan", "rencana pembiayaan", "pembiayaan", "scholarship"])
      ?? pickFieldByType(sub, "MULTIPLE_CHOICE"),
  };
}

async function ingestSubmission(sub: EnrichedSubmission): Promise<
  | { action: "created"; leadId: string }
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
    updatedAt: now,
  };

  const { data: existing, error: lookupErr } = await supabase
    .from("Lead")
    .select("id")
    .eq("tallySubmissionId", tallySubmissionId)
    .maybeSingle();
  if (lookupErr) return { action: "error", error: lookupErr.message };

  if (existing) {
    const { error: updErr } = await supabase
      .from("Lead")
      .update(baseFields)
      .eq("id", existing.id);
    if (updErr) return { action: "error", error: updErr.message };
    return { action: "updated", leadId: existing.id };
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

  return { action: "created", leadId: id };
}

export async function syncTallySubmissions(): Promise<SyncResult> {
  const submissions = await fetchAllEnrichedSubmissions();
  const result: SyncResult = {
    total: submissions.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const sub of submissions) {
    try {
      const r = await ingestSubmission(sub);
      switch (r.action) {
        case "created": result.created++; break;
        case "updated": result.updated++; break;
        case "skipped": result.skipped++; break;
        case "error":   result.errors.push(`${sub.id}: ${r.error}`); break;
      }
    } catch (err) {
      result.errors.push(`${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
