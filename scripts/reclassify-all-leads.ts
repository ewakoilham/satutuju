/**
 * Phase 12 — one-off reclassification of every Lead row.
 *
 * Reads all leads from Supabase, re-runs classifyLead() with the new
 * universities.json-driven partner logic, writes back any change. Run
 * once after deploying the Phase 12 changes:
 *
 *   node scripts/reclassify-all-leads.mjs
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 */

import { createClient } from "@supabase/supabase-js";
import { classifyLead } from "@/lib/leads/bucketing";
import { MENTORS } from "@/lib/mentors";
import { config as loadEnv } from "dotenv";

loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const mentorCountries = MENTORS.map((m) => ({ country: m.country ?? null }));

  const { data: leads, error } = await supabase
    .from("Lead")
    .select(
      'id, name, "targetCampusAndProgram", bucket, "bucketReason", "isCampusPartner", "partnerProgramScope"',
    );
  if (error) { console.error(error); process.exit(1); }
  if (!leads) { console.error("no leads"); process.exit(1); }
  console.log(`Reclassifying ${leads.length} leads…`);

  let changed = 0;
  let unchanged = 0;
  let bucketChanged = 0;
  const transitions = new Map<string, number>();
  for (const lead of leads) {
    const cls = classifyLead(lead.targetCampusAndProgram ?? "", mentorCountries);
    const bucketDiff = cls.bucket !== lead.bucket;
    const diff =
      bucketDiff ||
      cls.isCampusPartner !== lead.isCampusPartner ||
      (cls.partnerProgramScope ?? null) !== (lead.partnerProgramScope ?? null);
    if (!diff) { unchanged++; continue; }
    const transitionKey = `${lead.bucket}→${cls.bucket}`;
    transitions.set(transitionKey, (transitions.get(transitionKey) ?? 0) + 1);
    // Phase 15: clear the review fields when the BUCKET changes — the
    // signal admin previously confirmed is now stale. Partner-scope-only
    // changes don't reset (the bucket decision is what admin reviews).
    const reviewReset = bucketDiff
      ? { classificationReviewedAt: null, classificationReviewedBy: null, classificationReviewNote: null }
      : {};
    const { error: updErr } = await supabase.from("Lead").update({
      bucket: cls.bucket,
      bucketReason: cls.reason,
      parsedCountry: cls.parsedCountry,
      parsedCampus: cls.parsedCampus,
      parsedField: cls.parsedField,
      isCampusPartner: cls.isCampusPartner,
      hasCountryMentor: cls.hasCountryMentor,
      partnerProgramScope: cls.partnerProgramScope,
      ...reviewReset,
      updatedAt: new Date().toISOString(),
    }).eq("id", lead.id);
    if (updErr) {
      console.error(`[${lead.id}] update failed:`, updErr.message);
      continue;
    }
    changed++;
    if (bucketDiff) bucketChanged++;
  }
  console.log(`✓ ${changed} changed · ${unchanged} unchanged`);
  if (bucketChanged > 0) {
    console.log(`  ↳ ${bucketChanged} leads had bucket change → review flag reset (admin needs to re-confirm)`);
  }
  console.log("Transitions:");
  for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
