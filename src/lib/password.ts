/**
 * Minimum password policy, shared by signup / reset-password /
 * change-password so the rule lives in one place.
 *
 * Baseline: at least 8 characters. (Intentionally simple — length is the
 * single biggest factor; tighten with complexity/breach checks later if
 * needed.)
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message if the password is unacceptable, else null. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}
