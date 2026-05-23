/** TypeScript types for the leads pipeline. Mirrors the Prisma models in
 *  prisma/schema.prisma. Stay in sync if the schema evolves. */

export const LEAD_BUCKETS = ["A", "B", "C", "D", "incomplete", "domestic", "unclassified"] as const;
export type LeadBucket = (typeof LEAD_BUCKETS)[number];

export const LEAD_STAGES = [
  "new",
  "outreach_sent",
  "whatsapp_read",   // WA passive engagement (Fonnte status=read)
  "email_opened",    // Email tracking pixel fired (Resend webhook)
  "email_clicked",   // Lead clicked a link inside the email
  "call_scheduled",
  "call_completed",
  "waitlist",         // Phase 11: linear stage, between call_completed and
                      // deposit_pending. Lead is parked but still active —
                      // admin can resume to deposit_pending or terminate.
  "deposit_pending",  // invoice sent, awaiting mentee confirmation
  "deposit_agreed",   // mentee confirmed willingness to pay, transfer not yet received
  "deposit_paid",     // deposit lunas — transfer confirmed
  "matched",
  "declined",
  "rejected",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/**
 * Stages that represent a hard end to the funnel — NOT part of the
 * linear progression. They can fire from any earlier stage without
 * implying the lead traversed the intermediate stages. Phase 11.3:
 *
 *   • Transitioning TO an off-ramp resets every stage-click step to
 *     pending (those linear actions didn't actually happen).
 *   • Transitioning OUT of an off-ramp re-syncs step state against
 *     the new linear position.
 *   • Forward-fan-out is skipped when target is an off-ramp.
 *
 * Note: `matched` is the linear goal-state, NOT an off-ramp.
 */
export const TERMINAL_OFF_RAMP_STAGES: readonly LeadStage[] = ["declined", "rejected"];

export function isTerminalOffRamp(stage: LeadStage): boolean {
  return (TERMINAL_OFF_RAMP_STAGES as readonly string[]).includes(stage);
}

/** Stages where Call Panel is contextually relevant — admin needs to
 *  capture readiness/notes/decision data here. Used by both the panel
 *  itself (to hide for earlier stages) and its parent section wrapper. */
export const CALL_PANEL_STAGES: readonly LeadStage[] = [
  "call_scheduled",
  "call_completed",
  "deposit_pending",
  "deposit_paid",
  "matched",
];

/** Returns `target` if it would be a forward step from `currentStage`
 *  along LEAD_STAGES order. Returns null when the move would be a no-op
 *  or backward step. Used everywhere we want monotonic advancement
 *  (Resend webhook open/click events, Calendar sync, etc.) so engagement
 *  events don't accidentally downgrade a lead that's already past. */
export function maybeAdvanceStage(currentStage: string, target: LeadStage): LeadStage | null {
  const order = LEAD_STAGES as readonly string[];
  const ci = order.indexOf(currentStage);
  const ti = order.indexOf(target);
  if (ci < 0 || ti < 0) return null;
  return ti > ci ? target : null;
}

export const FUNDING_PLANS = ["scholarship", "self_funded", "partial"] as const;
export type FundingPlan = (typeof FUNDING_PLANS)[number];

export const PARSED_FIELDS = ["STEM", "Business", "unclear"] as const;
export type ParsedField = (typeof PARSED_FIELDS)[number];

export const STEP_AUTO_TRIGGERS = [
  "classified",        // fired when lead is created + auto-classified (Tally sync or manual entry)
  "email_sent",
  "email_opened",
  "email_clicked",
  "whatsapp_sent",
  "whatsapp_read",
  "call_scheduled",    // fired when Google Calendar sync detects a booking
  "waitlist",          // fired when stage advances to waitlist (Phase 11.2)
  "deposit_pending",   // fired when stage advances to deposit_pending
  "deposit_agreed",    // fired when stage advances to deposit_agreed
  "deposit_paid",      // fired when stage advances to deposit_paid
  "matched",           // fired when admin matches a mentor
] as const;
export type StepAutoTrigger = (typeof STEP_AUTO_TRIGGERS)[number];

/**
 * Each auto-trigger has one of 3 runtime behaviors. The PipelineChecklist
 * UI uses this to decide whether the step's checkbox is clickable, and
 * the Pipeline Manager uses it to color-code badges + group its dropdown.
 *
 *   event        — fired by an external system event (Resend / Fonnte /
 *                  lead-creation hook). Read-only in checklist; admin
 *                  can't fake-toggle.
 *   stage-click  — corresponds to a stage transition admin can drive.
 *                  Checklist makes the checkbox clickable: click →
 *                  /stage advance → server-side STAGE_TO_STEP_TRIGGER
 *                  fires the step.
 *   stage-system — corresponds to a stage advance owned by an external
 *                  system (currently only Google Calendar sync). Admin
 *                  can't manual-advance from the checklist (would fake
 *                  "call scheduled" without a real booking).
 */
export type StepAutoTriggerCategory = "event" | "stage-click" | "stage-system";

export const TRIGGER_CATEGORY: Record<StepAutoTrigger, StepAutoTriggerCategory> = {
  classified:      "event",
  email_sent:      "event",
  email_opened:    "event",
  email_clicked:   "event",
  whatsapp_sent:   "event",
  whatsapp_read:   "event",
  call_scheduled:  "stage-system",
  waitlist:        "stage-click",
  deposit_pending: "stage-click",
  deposit_agreed:  "stage-click",
  deposit_paid:    "stage-click",
  // `matched` is fired externally — when admin creates a Pairing in
  // /dashboard/pairings the pairing route looks up the lead by email
  // and auto-advances + fires this trigger. NOT clickable from the
  // pipeline checklist (would otherwise let admin tick "matched"
  // without an actual Pairing row).
  matched:         "event",
};

/** Human-friendly label per trigger, used by Pipeline Manager + the
 *  PipelineChecklist badge + the per-lead Cockpit. Indonesian to match
 *  the rest of the admin surface. */
export const TRIGGER_LABEL: Record<StepAutoTrigger, string> = {
  classified:      "Lead diklasifikasi",
  email_sent:      "Email terkirim",
  email_opened:    "Email dibuka",
  email_clicked:   "Email diklik",
  whatsapp_sent:   "WhatsApp terkirim",
  whatsapp_read:   "WhatsApp dibaca",
  call_scheduled:  "Call terjadwal",
  waitlist:        "Stage → waitlist",
  deposit_pending: "Stage → deposit pending",
  deposit_agreed:  "Stage → bersedia bayar",
  deposit_paid:    "Stage → deposit lunas",
  matched:         "Stage → matched",
};

/** Short inline hint shown next to a step label in PipelineChecklist.
 *  Replaces the verbose badge + description block — admin gets a one-
 *  glance read of WHEN the step fires without a wall of text. */
export const TRIGGER_HINT: Record<StepAutoTrigger, string> = {
  classified:      "otomatis saat lead masuk",
  email_sent:      "otomatis saat email terkirim",
  email_opened:    "otomatis saat email dibuka",
  email_clicked:   "otomatis saat link email diklik",
  whatsapp_sent:   "otomatis saat WhatsApp terkirim",
  whatsapp_read:   "otomatis saat WhatsApp dibaca",
  call_scheduled:  "otomatis saat Google Calendar booking",
  waitlist:        "klik untuk advance",
  deposit_pending: "klik untuk advance",
  deposit_agreed:  "klik untuk advance",
  deposit_paid:    "klik untuk advance",
  matched:         "otomatis saat dipair via tab Pairings",
};

/**
 * Stage-specific placeholder used by the inline note textarea in the
 * pipeline checklist (advance form). Hints at the typical context an
 * admin would record when transitioning the lead to that stage.
 * Defaults to a generic message if a stage isn't in the map.
 */
export const STAGE_NOTE_PLACEHOLDER: Partial<Record<LeadStage, string>> = {
  waitlist:        "mis. Belum siap secara timeline · follow-up 2 minggu lagi tgl 5 Juni",
  deposit_pending: "mis. Invoice sudah dikirim via WA · tunggu balasan dalam 1×24 jam",
  deposit_agreed:  "mis. Mentee commit transfer 30 Juni setelah gajian · nominal Rp 1jt full",
  deposit_paid:    "mis. Transfer Rp 1jt diterima 25 Mei · bukti via WA · siap matching",
};

/**
 * Stage-note marker shared by the /stage route (writes the marker into
 * LeadStageHistory.note) and PipelineChecklist (reads it back for
 * past-stage display). Centralised here so both ends of the protocol
 * cannot drift apart.
 *
 * Encoded form: `[catatan stage <stage>] <body>`
 */
const STAGE_NOTE_MARKER_RX = /\[catatan stage [^\]]+\]\s*([\s\S]+)/;

/** Wrap a note with the stage marker for storage in history.note. */
export function encodeStageNote(stage: LeadStage, body: string): string {
  return `[catatan stage ${stage}] ${body}`;
}

/** Strip the stage marker from a stored history note. Returns the raw
 *  note unchanged when no marker is present. */
export function decodeStageNote(note: string): string {
  const m = STAGE_NOTE_MARKER_RX.exec(note);
  return m ? m[1].trim() : note;
}

/** Display metadata for each trigger category. Used by Pipeline Manager
 *  (badge color + section header) and PipelineChecklist (badge tone). */
export const CATEGORY_META: Record<
  StepAutoTriggerCategory,
  { label: string; desc: string; tone: "violet" | "blue" | "emerald"; iconName: string }
> = {
  event: {
    label: "Event",
    desc: "Fired by Resend / Fonnte / lead creation. Read-only.",
    tone: "violet",
    iconName: "lock",
  },
  "stage-click": {
    label: "Klik",
    desc: "Admin klik checkbox di checklist → advance stage → step auto-fires.",
    tone: "blue",
    iconName: "arrow-right",
  },
  "stage-system": {
    label: "Calendar",
    desc: "Google Calendar booking auto-fires. Admin tidak bisa manual-advance.",
    tone: "emerald",
    iconName: "calendar",
  },
};

/**
 * Stage → step trigger map. Single source of truth shared by both the
 * `/api/new-leads/[id]/stage` route (manual admin advance) and the
 * `/api/new-leads/[id]/call` route (decision-driven advance on call
 * completion). Stages not in this map have no listening step trigger
 * by design (e.g. terminal stages: declined, waitlist, rejected).
 */
/**
 * Stage → step-auto-trigger mapping. When a lead's stage transitions to
 * one of these stages, `completeStepByTrigger` ticks the step whose
 * autoTrigger matches.
 *
 * Phase 11 restored `deposit_pending` to this map — the step "Menunggu
 * Konfirmasi Deposit" is now stage-click (clicking advances stage +
 * auto-ticks). This guarantees zero drift between step.status and
 * Lead.stage: one source of truth, always in sync.
 */
export const STAGE_TO_STEP_TRIGGER: Partial<Record<LeadStage, StepAutoTrigger>> = {
  call_scheduled:  "call_scheduled",
  waitlist:        "waitlist",
  deposit_pending: "deposit_pending",
  deposit_agreed:  "deposit_agreed",
  deposit_paid:    "deposit_paid",
  matched:         "matched",
};

/**
 * Indonesian display label per stage. Replaces the local English/
 * Indonesian-mixed map that used to live in LeadStageBadge so every
 * surface reads from one source.
 */
export const STAGE_LABEL: Record<LeadStage, string> = {
  new:             "Baru",
  outreach_sent:   "Outreach Terkirim",
  whatsapp_read:   "WhatsApp Dibaca",
  email_opened:    "Email Dibuka",
  email_clicked:   "Email Diklik",
  call_scheduled:  "Call Terjadwal",
  call_completed:  "Call Selesai",
  deposit_pending: "Menunggu Konfirmasi Deposit",
  deposit_agreed:  "Bersedia Bayar Deposit",
  deposit_paid:    "Deposit Lunas",
  matched:         "Sudah Match",
  declined:        "Mundur",
  waitlist:        "Waitlist",
  rejected:        "Ditolak",
};

/** Channels admin can pick when doing reachout. "both" is two API calls
 *  fired in parallel — independently logged so partial failures don't
 *  block the success. */
export const OUTREACH_CHANNELS = ["email", "whatsapp"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const STEP_STATUSES = ["pending", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const LEAD_DECISIONS = [
  "proceed",            // tunggu konfirmasi deposit 1x24 jam (→ deposit_pending)
  "agree_to_pay",       // mentee langsung commit bayar deposit (→ deposit_agreed)
  "waitlist",           // tahan 1 minggu (→ waitlist)
  "declined_by_student",// mentee mundur
  "rejected_by_us",     // kita tolak
] as const;
export type LeadDecision = (typeof LEAD_DECISIONS)[number];

/** DB keys for the four email templates. Bucket grouping:
 *  - `A_B_C` (invitation): leads with mentor available OR partner kampus
 *  - `D` (confirmation): leads with neither — outside our network
 *  - `incomplete` (re-engagement): target field empty in Tally form
 *  - `domestic` (polite decline): target is a domestic Indonesian university */
export const TEMPLATE_BUCKETS = ["A_B_C", "D", "incomplete", "domestic"] as const;
export type TemplateBucket = (typeof TEMPLATE_BUCKETS)[number];

export interface Lead {
  id: string;
  // From Tally
  name: string;
  email: string;
  whatsappNumber: string | null;
  targetCampusAndProgram: string;
  fundingPlan: FundingPlan | string;
  submittedAt: string;
  tallySubmissionId: string | null;
  // System-derived
  bucket: LeadBucket;
  bucketReason: string | null;
  parsedCountry: string | null;
  parsedCampus: string | null;
  parsedField: ParsedField | null;
  isCampusPartner: boolean | null;
  hasCountryMentor: boolean;
  // Funnel state
  stage: LeadStage;
  outreachSentAt: string | null;
  emailOpenedAt: string | null;
  emailClickedAt: string | null;
  whatsappSentAt: string | null;
  whatsappReadAt: string | null;
  callScheduledAt: string | null;
  callCompletedAt: string | null;
  calendarEventId: string | null;
  // Decision
  assignedInterviewer: string | null;
  depositTier: number | null;
  readinessScore: number | null;
  callNotes: string | null;
  redFlags: string | null;
  decision: LeadDecision | null;
  /** Per-stage freeform note. Lives on the Lead row for the CURRENT
   *  stage. On stage transition the value is captured into the
   *  outgoing LeadStageHistory row's `note` field and this column is
   *  cleared — so historical notes are preserved per-stage in the
   *  history table while the active note is here. Phase 11. */
  stageNote: string | null;
  /** When the lead matched a partner university, the partner's program
   *  scope (Tokyo Cocoro = "English Language", Kudan = "All", …).
   *  null when the matched university has no restriction OR the lead
   *  isn't matched to a partner. Phase 12. */
  partnerProgramScope: string | null;
  mentorMatchedId: string | null;
  // Bookkeeping
  createdAt: string;
  updatedAt: string;
}

export interface LeadStageHistory {
  id: string;
  leadId: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

export interface OutreachLog {
  id: string;
  leadId: string;
  channel: string;
  templateUsed: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "bounced" | "failed";
  resendMessageId: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  errorMessage: string | null;
}

export interface LeadStepDefinition {
  id: string;
  order: number;
  label: string;
  description: string | null;
  autoTrigger: StepAutoTrigger | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStepStatusRow {
  id: string;
  leadId: string;
  stepId: string;
  status: StepStatus;
  completedAt: string | null;
  completedBy: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadEmailTemplate {
  id: string;
  bucket: TemplateBucket;
  subject: string;
  body: string;
  whatsappBody: string | null;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface LeadAutoSendSetting {
  id: "singleton";
  enabled: boolean;
  delayMinutes: number;
  lastRunAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Pick the right email template bucket from the lead's classification bucket.
 *  A/B/C all receive the invitation template (we have something to offer);
 *  D receives the confirmation template (outside our network);
 *  incomplete = re-engage to fill missing target;
 *  domestic = polite decline (we only cover study abroad);
 *  unclassified has no auto-template (admin reviews + overrides bucket first). */
export function templateBucketFor(bucket: LeadBucket): TemplateBucket | null {
  if (bucket === "A" || bucket === "B" || bucket === "C") return "A_B_C";
  if (bucket === "D") return "D";
  if (bucket === "incomplete") return "incomplete";
  if (bucket === "domestic") return "domestic";
  return null;
}

/** Display label for the funding plan token. Mirrors the option text that
 *  appears in the Tally form (`9qO65Q`) so admins see the same wording
 *  in the dashboard filter as the respondent picked. */
export function fundingPlanLabelId(plan: string): string {
  if (plan === "scholarship") return "Full scholarship";
  if (plan === "self_funded") return "Self-funded";
  if (plan === "partial") return "Partial scholarship";
  return plan;
}
