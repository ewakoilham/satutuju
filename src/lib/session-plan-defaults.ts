/** Default session plan template for newly-paired mentees.
 *
 *  Model (locked curriculum):
 *    - The 10 curriculum sessions are FIXED. Their title/objective/deliverables/
 *      docs come from CURRICULUM and cannot be renamed. A mentor can only:
 *        • toggle each on/off ("diadakan" / "tidak diadakan") via `enabled`
 *        • reorder
 *        • duplicate (a duplicate keeps the same `curriculumNum`, so it shares
 *          the same documents — the mentee uploads once, both are satisfied)
 *    - The mentor may also add CUSTOM sessions (no `curriculumNum`): free title,
 *      upload-only, no curriculum template.
 *
 *  A row is "core" when `curriculumNum` is set, "custom" otherwise.
 *  Sourced from src/lib/curriculum.ts and expressed in the SessionPlanRow shape
 *  the SessionPlan model persists.
 */

import { CURRICULUM } from "@/lib/curriculum";

export type PlanPhase = "Discovery" | "Planning" | "Writing" | "Execution" | "Closing";

export interface SessionPlanRow {
  /** Stable id within the plan — generated client-side, persisted as JSON. */
  id: string;
  /** 1-based order across ALL rows (enabled + disabled). Reordering rewrites this. */
  order: number;
  title: string;
  phase: PlanPhase;
  durationMinutes: number;
  /** Curriculum session number (1–10) this row maps to. Set for core sessions
   *  AND their duplicates — drives the locked title + documents/templates.
   *  Undefined for custom sessions. */
  curriculumNum?: number;
  /** Whether this session is held. Core sessions can be toggled off; custom
   *  sessions are always on. Treat `undefined` as true (legacy + custom). */
  enabled?: boolean;
  /** True for a duplicate of a core session (deletable; the canonical core row
   *  is toggled, not deleted). */
  dup?: boolean;
  /** Curriculum detail (carried for display). Optional. */
  objective?: string;
  deliverables?: string[];
  menteePrep?: string[];
  mentorPrep?: string[];
  /** Documents the mentee should upload/prepare for this session. */
  docChecklist?: string[];
}

export const PLAN_MAX_SESSIONS = 20; // safety cap on total rows (incl. duplicates + custom)
export const PLAN_DEFAULT_DURATION = 60;
export const PLAN_PHASES: PlanPhase[] = ["Discovery", "Planning", "Writing", "Execution", "Closing"];
// Session length is fixed to the two bookable slot lengths so the plan stays in
// sync with the calendar (slots are 60 / 90 min). Not free-entry.
export const PLAN_DURATION_OPTIONS = [60, 90] as const;

const PHASE_LABEL: Record<string, PlanPhase> = {
  discovery: "Discovery",
  planning: "Planning",
  writing: "Writing",
  execution: "Execution",
  closing: "Closing",
};

/** A row is "core" (locked curriculum session) when it maps to a curriculum number. */
export function isCoreRow(row: SessionPlanRow): boolean {
  return row.curriculumNum != null;
}

/** Whether a row counts as held: custom rows always; core rows when not toggled off. */
export function isEnabled(row: SessionPlanRow): boolean {
  if (row.curriculumNum == null) return true; // custom — always held
  return row.enabled !== false;
}

/** The rows that will actually be published to the mentee, in order. */
export function enabledRows(rows: SessionPlanRow[]): SessionPlanRow[] {
  return rows.filter(isEnabled);
}

/** Build a fresh default plan: 10 core curriculum rows, all enabled. Always
 *  generates new row ids so the same template can seed multiple pairings. */
export function buildDefaultPlan(): SessionPlanRow[] {
  return CURRICULUM.map((s, i) => ({
    id: cryptoRandomId(),
    order: i + 1,
    title: s.topic,
    phase: PHASE_LABEL[s.phase] || "Writing",
    durationMinutes: PLAN_DEFAULT_DURATION,
    curriculumNum: s.sessionNum,
    enabled: true,
    objective: s.objective,
    deliverables: s.deliverables,
    menteePrep: s.menteePrep,
    mentorPrep: s.mentorPrep,
    docChecklist: s.docChecklist,
  }));
}

/** Backfill the locked-curriculum fields on legacy rows saved before this model
 *  (no curriculumNum/enabled). Core rows are matched by title to a curriculum
 *  session; unmatched rows become custom. Idempotent. */
export function normalizeRows(rows: SessionPlanRow[]): SessionPlanRow[] {
  const byTitle = new Map<string, (typeof CURRICULUM)[number]>();
  for (const s of CURRICULUM) byTitle.set(s.topic.toLowerCase().trim(), s);
  return rows.map((r) => {
    if (r.curriculumNum != null) {
      return { ...r, enabled: r.enabled !== false };
    }
    // Strip a trailing "(salinan)" so duplicates still match a curriculum title.
    const base = r.title.toLowerCase().replace(/\s*\(salinan\)\s*$/i, "").trim();
    const tpl = byTitle.get(base);
    if (tpl) {
      return {
        ...r,
        curriculumNum: tpl.sessionNum,
        enabled: r.enabled !== false,
        dup: /\(salinan\)/i.test(r.title) || r.dup,
        objective: r.objective ?? tpl.objective,
        deliverables: r.deliverables ?? tpl.deliverables,
        menteePrep: r.menteePrep ?? tpl.menteePrep,
        mentorPrep: r.mentorPrep ?? tpl.mentorPrep,
        docChecklist: r.docChecklist ?? tpl.docChecklist,
      };
    }
    return r; // genuine custom session
  });
}

/** Phase distribution shown in the side rail (counts enabled rows only). */
export function planPhaseBreakdown(plan: SessionPlanRow[]): Record<PlanPhase, number> {
  const out: Record<PlanPhase, number> = {
    Discovery: 0, Planning: 0, Writing: 0, Execution: 0, Closing: 0,
  };
  for (const row of enabledRows(plan)) out[row.phase] = (out[row.phase] || 0) + 1;
  return out;
}

/** Total minutes across the held (enabled) rows. */
export function planTotalMinutes(plan: SessionPlanRow[]): number {
  return enabledRows(plan).reduce((acc, r) => acc + r.durationMinutes, 0);
}

/** Validate a plan against the constraints. Returns the first failure message
 *  or null when valid. */
export function validatePlan(plan: SessionPlanRow[]): string | null {
  if (plan.length > PLAN_MAX_SESSIONS) return `Maksimum ${PLAN_MAX_SESSIONS} sesi.`;
  if (enabledRows(plan).length < 1) return "Minimal 1 sesi harus diadakan.";
  for (const row of plan) {
    if (!row.title.trim()) return "Setiap sesi harus punya judul.";
    if (!PLAN_PHASES.includes(row.phase)) return `Fase tidak valid: ${row.phase}`;
    if (!PLAN_DURATION_OPTIONS.includes(row.durationMinutes as 60 | 90)) {
      return "Durasi sesi harus 60 atau 90 menit.";
    }
  }
  return null;
}

function cryptoRandomId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);
}
