import crypto from "crypto";

/**
 * Prefix-aware ID generator shared across all leads-pipeline tables.
 *
 *   lead_       → Lead
 *   lsh_        → LeadStageHistory
 *   olg_        → OutreachLog
 *   csl_        → LeadStepStatus
 *   step_       → LeadStepDefinition (manually seeded)
 *
 * Same shape everywhere: `<prefix><22-char hex>`. 22 chars of uniform
 * hex = 88 bits of entropy, plenty for primary keys in a single-tenant
 * Postgres.
 */
export function makeId(prefix: string): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

export const newLeadId = () => makeId("lead_");
export const newStageHistoryId = () => makeId("lsh_");
export const newOutreachLogId = () => makeId("olg_");
export const newStepStatusId = () => makeId("csl_");
