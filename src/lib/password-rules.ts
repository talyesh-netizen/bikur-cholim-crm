/**
 * The password rules set in Supabase (Authentication → Sign In /
 * Providers → Email, September 2026): at least 12 characters, with a
 * lowercase letter, an uppercase letter, a digit and a symbol. Supabase
 * is what actually enforces them; this copy exists so the app can say
 * plainly what's missing before anything is sent, instead of a vague
 * "something went wrong". Keep the two in step if the setting changes.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_RULES_TEXT =
  "At least 12 characters, with a lowercase letter, a capital letter, a number and a symbol (like ! or -).";

/** What's missing from a password, in plain words -- or null if it
 * meets every rule. */
export function passwordProblem(password: string): string | null {
  const missing: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) missing.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password)) missing.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) missing.push("a capital letter");
  if (!/[0-9]/.test(password)) missing.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) missing.push("a symbol (like ! or -)");
  return missing.length ? `Your password needs ${missing.join(", ")}.` : null;
}
