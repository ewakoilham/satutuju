/** Supabase select column lists. Hoisted so the API routes and the
 *  shared server-side fetcher don't drift. Add a new column? Update here
 *  once, not 3-4 times. */

export const MENTOR_SELECT_COLUMNS =
  '"id","fullName","nickname","initials","university","major","country","flagCode","scholarship","color","avatarPath","galleryPaths","hometown","message","achievement","currentStudiesRaw","s1","scholarshipRaw","isActive","displayOrder","source"';

export const LANDING_PHOTO_COLUMNS = "mentorId, location, photoSrc, zoom, posX, posY";

export const MENTOR_OVERRIDE_COLUMNS =
  "mentorId, nickname, message, achievement, currentStudies, s1, scholarship";

// ──────────────────────────────────────────────────────────────────────────
// Leads pipeline column lists. Match the Prisma model order so column
// indexes line up if anything iterates positionally.
// ──────────────────────────────────────────────────────────────────────────

export const LEAD_SELECT_COLUMNS =
  'id, name, email, "whatsappNumber", "targetCampusAndProgram", "fundingPlan", ' +
  '"submittedAt", "tallySubmissionId", bucket, "bucketReason", ' +
  '"parsedCountry", "parsedCampus", "parsedField", "isCampusPartner", "hasCountryMentor", ' +
  'stage, "outreachSentAt", "emailOpenedAt", "emailClickedAt", ' +
  '"whatsappSentAt", "whatsappReadAt", ' +
  '"callScheduledAt", "callCompletedAt", "calendarEventId", "assignedInterviewer", "depositTier", ' +
  '"readinessScore", "callNotes", "redFlags", decision, "stageNote", "partnerProgramScope", "mentorMatchedId", ' +
  '"createdAt", "updatedAt"';

export const LEAD_STAGE_HISTORY_COLUMNS =
  'id, "leadId", "fromStage", "toStage", "changedBy", note, "createdAt"';

export const OUTREACH_LOG_COLUMNS =
  'id, "leadId", channel, "templateUsed", subject, body, "sentAt", status, ' +
  '"resendMessageId", "openedAt", "clickedAt", "bouncedAt", "errorMessage"';

export const LEAD_STEP_DEFINITION_COLUMNS =
  'id, "order", label, description, "autoTrigger", "isActive", "createdAt", "updatedAt"';

export const LEAD_STEP_STATUS_COLUMNS =
  'id, "leadId", "stepId", status, "completedAt", "completedBy", note, "createdAt", "updatedAt"';

export const LEAD_EMAIL_TEMPLATE_COLUMNS =
  'id, bucket, subject, body, "whatsappBody", version, "updatedAt", "updatedBy"';

export const LEAD_AUTO_SEND_SETTING_COLUMNS =
  'id, enabled, "delayMinutes", "lastRunAt", "updatedAt", "updatedBy"';

export const GOOGLE_CALENDAR_AUTH_COLUMNS =
  'id, "refreshToken", scope, "googleEmail", "connectedAt", "connectedBy", "lastSyncAt", "lastSyncToken", "updatedAt"';

// ──────────────────────────────────────────────────────────────────────────
// Phase 13: mentor-side lead visibility. Strict whitelist — never let
// stage/bucket/decision/callNotes/etc. land in a mentor's query.
// ──────────────────────────────────────────────────────────────────────────

export const MENTOR_LEAD_SELECT_COLUMNS =
  'id, name, email, "whatsappNumber", "targetCampusAndProgram", "fundingPlan", ' +
  '"submittedAt", "tallySubmissionId", ' +
  '"parsedCountry", "parsedCampus", "parsedField", ' +
  '"createdAt"';

export const LEAD_NOTE_COLUMNS =
  'id, "leadId", "authorId", "parentNoteId", content, "editedAt", "createdAt"';

export const MENTOR_LEAD_FLAG_COLUMNS =
  'id, "leadId", "mentorId", context, "createdAt"';
