import "server-only";

import { supabase } from "@/lib/supabase";
import type { StepAutoTrigger } from "./types";

/**
 * Helpers that maintain the per-lead pipeline checklist
 * (LeadStepStatus rows) — one row per (lead, active step definition).
 *
 * - `seedStepStatusesForLead`: insert pending rows for a brand-new lead
 *   so the checklist appears immediately in the admin UI.
 * - `seedStepStatusForExistingLeadsOnNewStep`: retro-fills when admin
 *   adds a NEW step definition — every existing lead gets a pending row.
 * - `completeStepByTrigger`: called from system event handlers (email
 *   sent, opened, clicked, deposit_paid, matched). Flips matching steps
 *   to done in one DB roundtrip.
 */

function generateId(): string {
  // cuid-shaped string (matches existing tables like Notification);
  // sufficient for primary keys without pulling in another dep.
  return "csl_" + crypto.randomUUID().replace(/-/g, "").slice(0, 22);
}

/** Insert one LeadStepStatus(pending) for every active LeadStepDefinition. */
export async function seedStepStatusesForLead(leadId: string): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const { data: steps, error: stepsErr } = await supabase
    .from("LeadStepDefinition")
    .select("id")
    .eq("isActive", true);
  if (stepsErr) return { ok: false, inserted: 0, error: stepsErr.message };
  if (!steps || steps.length === 0) return { ok: true, inserted: 0 };

  const now = new Date().toISOString();
  const rows = steps.map((s) => ({
    id: generateId(),
    leadId,
    stepId: s.id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }));

  const { error: insertErr } = await supabase
    .from("LeadStepStatus")
    .insert(rows);
  if (insertErr) return { ok: false, inserted: 0, error: insertErr.message };

  return { ok: true, inserted: rows.length };
}

/** Retro-fill: when admin adds a new step, every existing lead needs a
 *  pending row for it. 127 leads is small — synchronous is fine. */
export async function seedStepStatusForExistingLeadsOnNewStep(stepId: string): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const { data: leads, error: leadsErr } = await supabase
    .from("Lead")
    .select("id");
  if (leadsErr) return { ok: false, inserted: 0, error: leadsErr.message };
  if (!leads || leads.length === 0) return { ok: true, inserted: 0 };

  // Filter out leads that already have a row for this step (idempotent).
  const { data: existing } = await supabase
    .from("LeadStepStatus")
    .select("leadId")
    .eq("stepId", stepId);
  const existingLeadIds = new Set((existing ?? []).map((r) => r.leadId));

  const now = new Date().toISOString();
  const rows = leads
    .filter((l) => !existingLeadIds.has(l.id))
    .map((l) => ({
      id: generateId(),
      leadId: l.id,
      stepId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }));

  if (rows.length === 0) return { ok: true, inserted: 0 };

  const { error } = await supabase.from("LeadStepStatus").insert(rows);
  if (error) return { ok: false, inserted: 0, error: error.message };

  return { ok: true, inserted: rows.length };
}

/**
 * Auto-complete every step status for a lead whose step definition has
 * the matching `autoTrigger`. Idempotent — does nothing if already done.
 */
export async function completeStepByTrigger(
  leadId: string,
  trigger: StepAutoTrigger,
  completedBy: string = "system",
): Promise<{ ok: boolean; completed: number; error?: string }> {
  return completeStepsByTriggers(leadId, [trigger], completedBy);
}

/**
 * Bulk variant: fire multiple triggers in a single round-trip pair.
 * Used by /stage on forward transitions so a multi-stage jump doesn't
 * fan out into N serial DB calls.
 *
 * Upsert semantics (Phase 17 fix): for each matching step definition,
 * the lead either has an existing pending row → UPDATE to done, or
 * no row at all (because the step was added AFTER the lead was
 * created) → INSERT a new "done" row directly. Idempotent on rows
 * already "done" / "skipped" — they're left alone.
 *
 * Why the upsert matters: the previous version only did the UPDATE
 * branch. When a step was added late (e.g. "Waitlist" introduced
 * after 136 leads already existed), advancing one of those leads to
 * the waitlist stage silently no-op'd the step status — Lead.stage
 * said "waitlist" but the checklist showed it un-ticked. Single
 * source of truth was broken.
 */
export async function completeStepsByTriggers(
  leadId: string,
  triggers: readonly StepAutoTrigger[],
  completedBy: string = "system",
): Promise<{ ok: boolean; completed: number; error?: string }> {
  if (triggers.length === 0) return { ok: true, completed: 0 };
  const { data: steps, error: stepsErr } = await supabase
    .from("LeadStepDefinition")
    .select("id")
    .in("autoTrigger", triggers as unknown as string[])
    .eq("isActive", true);
  if (stepsErr) return { ok: false, completed: 0, error: stepsErr.message };
  if (!steps || steps.length === 0) return { ok: true, completed: 0 };

  const stepIds = steps.map((s) => s.id as string);
  const now = new Date().toISOString();

  // Existence check: split the matching step ids into "row exists" vs
  // "row missing". One round trip.
  const { data: existingRows, error: existingErr } = await supabase
    .from("LeadStepStatus")
    .select('"stepId", status')
    .eq("leadId", leadId)
    .in("stepId", stepIds);
  if (existingErr) return { ok: false, completed: 0, error: existingErr.message };
  const existingByStep = new Map<string, string>();
  for (const r of (existingRows ?? []) as Array<{ stepId: string; status: string }>) {
    existingByStep.set(r.stepId, r.status);
  }

  const missingStepIds: string[] = [];
  const pendingStepIds: string[] = [];
  for (const sid of stepIds) {
    const status = existingByStep.get(sid);
    if (status === undefined) missingStepIds.push(sid);
    else if (status === "pending") pendingStepIds.push(sid);
    // status === "done" | "skipped" → leave alone (idempotent).
  }

  let completed = 0;

  if (pendingStepIds.length > 0) {
    const { data: updated, error: updErr } = await supabase
      .from("LeadStepStatus")
      .update({ status: "done", completedAt: now, completedBy, updatedAt: now })
      .eq("leadId", leadId)
      .in("stepId", pendingStepIds)
      .select("id");
    if (updErr) return { ok: false, completed, error: updErr.message };
    completed += updated?.length ?? 0;
  }

  if (missingStepIds.length > 0) {
    const rows = missingStepIds.map((sid) => ({
      id: generateId(),
      leadId,
      stepId: sid,
      status: "done",
      completedAt: now,
      completedBy,
      createdAt: now,
      updatedAt: now,
    }));
    const { error: insErr } = await supabase
      .from("LeadStepStatus")
      .insert(rows);
    if (insErr) {
      // Phase 17.1: 23505 (unique_violation) means another concurrent
      // caller inserted the row(s) between our existence check and our
      // insert. Treat as success — the step is now correctly done
      // either way. Without this catch, duplicate webhook deliveries
      // or rapid user double-clicks would surface as failed stage
      // transitions even though the DB ended up consistent.
      if (insErr.code !== "23505") {
        return { ok: false, completed, error: insErr.message };
      }
      // For the racing-loser path, we don't know exactly which rows
      // were ours vs theirs — be conservative and report `completed`
      // as the rows we successfully held before the race.
    } else {
      completed += rows.length;
    }
  }

  return { ok: true, completed };
}
