/**
 * App-wide display text, kept in one place rather than hardcoded across
 * components. Phase One is single-department (see PLAN.md, "Roadmap
 * decisions log" — department support is intentionally deferred), but
 * keeping this text centralized means that if this ever does need to
 * change or vary, it's a one-line edit here rather than a search-and-
 * replace across the codebase.
 */
export const APP_NAME = "Senior Resident Support Services";
export const ORGANIZATION_NAME = "Bikur Cholim of Cleveland";

/** Used for anything that needs "today"/"right now" in the org's own
 * time rather than the server's (Vercel runs in UTC) -- e.g. the
 * dashboard's morning/afternoon/evening greeting. */
export const ORGANIZATION_TIMEZONE = "America/New_York";
