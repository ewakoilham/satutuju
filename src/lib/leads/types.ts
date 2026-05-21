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
  "deposit_pending",
  "deposit_paid",
  "matched",
  "declined",
  "waitlist",
  "rejected",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

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
  "classified",       // fired when lead is created + auto-classified (Tally sync or manual entry)
  "email_sent",
  "email_opened",
  "email_clicked",
  "whatsapp_sent",
  "whatsapp_read",
  "call_scheduled",   // fired when Google Calendar sync detects a booking
  "deposit_pending",  // fired when stage advances to deposit_pending
  "deposit_paid",     // fired when stage advances to deposit_paid
  "matched",          // fired when admin matches a mentor
] as const;
export type StepAutoTrigger = (typeof STEP_AUTO_TRIGGERS)[number];

/** Channels admin can pick when doing reachout. "both" is two API calls
 *  fired in parallel — independently logged so partial failures don't
 *  block the success. */
export const OUTREACH_CHANNELS = ["email", "whatsapp"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const STEP_STATUSES = ["pending", "done", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const LEAD_DECISIONS = [
  "proceed",
  "waitlist",
  "declined_by_student",
  "rejected_by_us",
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
