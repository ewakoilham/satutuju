import "server-only";

/**
 * Whitelist of client-editable MenteeProfile columns.
 *
 * Profile routes used to spread `...body` straight into the DB write after
 * deleting only id/userId/createdAt/updatedAt — a mass-assignment hole that
 * let a client write any column it could name. We instead pick only known
 * editable fields, so unexpected/unknown keys are silently dropped.
 *
 * Keep in sync with the MenteeProfile model in prisma/schema.prisma.
 */
export const MENTEE_PROFILE_FIELDS = [
  // Personal
  "fullLegalName", "dateOfBirth", "studentId", "phoneNumber",
  // Identity
  "idNumber", "nationality", "passportNumber", "currentAddress", "legalAddress",
  // Academic
  "mostRecentSchool", "levelOfStudy", "curriculum", "gpa",
  // Goals & preferences
  "intendedStudyProgram", "intendedMajor", "preferredDestinations",
  "preferredIntakeMonth", "preferredIntakeYear", "preferredEarliestIntake",
  "postGraduationPlan",
  // Test prep
  "englishTestStatus", "englishTestType", "englishTestDate", "englishTestScore",
  // Visa
  "hasAppliedVisa", "familyAppliedVisa", "hasRelativesInStudyCountry",
  "hasPermanentResidency",
  // Funding
  "fundingSource", "studyBudget",
  // Mentoring preferences
  "preferredPersonality", "preferredMentoringStyle", "preferredWorkingStyle",
  "preferredCommStyle", "preferredRoles",
] as const;

/** Return a new object containing only whitelisted profile fields present
 *  in `body`. Drops everything else (id, userId, role, unknown columns). */
export function pickProfileFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of MENTEE_PROFILE_FIELDS) {
    if (key in body) out[key] = body[key];
  }
  return out;
}
