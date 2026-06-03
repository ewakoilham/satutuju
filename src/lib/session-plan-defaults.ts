/** Default session plan template for newly-paired mentees.
 *
 *  Sourced from src/lib/curriculum.ts (the existing 10-session curriculum)
 *  but expressed in the SessionPlanRow shape that the SessionPlan model
 *  expects. The mentor edits this in /dashboard/mentee/[pairingId]/rencana-sesi
 *  before finalizing.
 *
 *  Constraints (enforced both client-side and in the API):
 *    - minimum 5 sessions
 *    - maximum 15 sessions
 *    - phase must be one of the 5 enum values
 *    - durationMinutes must be one of {45, 60, 75, 90, 105, 120}
 */

import { CURRICULUM } from "@/lib/curriculum";

export type PlanPhase = "Discovery" | "Planning" | "Writing" | "Execution" | "Closing";

export interface SessionPlanRow {
  /** Stable id within the plan — generated client-side, persisted as JSON. */
  id: string;
  /** 1-based order. Reordering rewrites this. */
  order: number;
  title: string;
  phase: PlanPhase;
  durationMinutes: number;
  /** Curriculum detail (so mentor & mentee understand what each session is).
   *  Seeded from the default curriculum; carried through finalize. Optional —
   *  custom/added sessions may have none. */
  objective?: string;
  deliverables?: string[];
  menteePrep?: string[];
  mentorPrep?: string[];
}

export const PLAN_MIN_SESSIONS = 5;
export const PLAN_MAX_SESSIONS = 15;
export const PLAN_DEFAULT_DURATION = 75;
export const PLAN_PHASES: PlanPhase[] = ["Discovery", "Planning", "Writing", "Execution", "Closing"];
// Duration is now free-entry (mentor types the minutes); we only bound it to a
// sane range instead of a fixed set.
export const PLAN_MIN_DURATION = 15;
export const PLAN_MAX_DURATION = 240;
export const PLAN_ALLOWED_DURATIONS = [45, 60, 75, 90, 105, 120];

const PHASE_LABEL: Record<string, PlanPhase> = {
  discovery: "Discovery",
  planning: "Planning",
  writing: "Writing",
  execution: "Execution",
  closing: "Closing",
};

/** Build a fresh default plan (10 rows across 5 phases). Always generates
 *  new row ids so the same template can seed multiple pairings without
 *  collision. */
export function buildDefaultPlan(): SessionPlanRow[] {
  return CURRICULUM.map((s, i) => ({
    id: cryptoRandomId(),
    order: i + 1,
    title: s.topic,
    phase: PHASE_LABEL[s.phase] || "Writing",
    durationMinutes: 75,
    objective: s.objective,
    deliverables: s.deliverables,
    menteePrep: s.menteePrep,
    mentorPrep: s.mentorPrep,
  }));
}

/** Phase distribution shown in the side rail ("kenapa 10 sesi?"). */
export function planPhaseBreakdown(plan: SessionPlanRow[]): Record<PlanPhase, number> {
  const out: Record<PlanPhase, number> = {
    Discovery: 0, Planning: 0, Writing: 0, Execution: 0, Closing: 0,
  };
  for (const row of plan) out[row.phase] = (out[row.phase] || 0) + 1;
  return out;
}

/** Total minutes across all rows. Used in the sticky footer summary. */
export function planTotalMinutes(plan: SessionPlanRow[]): number {
  return plan.reduce((acc, r) => acc + r.durationMinutes, 0);
}

/** Validate a plan against the constraints. Returns the first failure
 *  message or null when valid. */
export function validatePlan(plan: SessionPlanRow[]): string | null {
  if (plan.length < PLAN_MIN_SESSIONS) return `Minimum ${PLAN_MIN_SESSIONS} sesi.`;
  if (plan.length > PLAN_MAX_SESSIONS) return `Maksimum ${PLAN_MAX_SESSIONS} sesi.`;
  for (const row of plan) {
    if (!row.title.trim()) return "Setiap sesi harus punya judul.";
    if (!PLAN_PHASES.includes(row.phase)) return `Fase tidak valid: ${row.phase}`;
    if (!Number.isFinite(row.durationMinutes) || !Number.isInteger(row.durationMinutes) ||
        row.durationMinutes < PLAN_MIN_DURATION || row.durationMinutes > PLAN_MAX_DURATION) {
      return `Durasi harus ${PLAN_MIN_DURATION}–${PLAN_MAX_DURATION} menit.`;
    }
  }
  return null;
}

function cryptoRandomId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);
}
