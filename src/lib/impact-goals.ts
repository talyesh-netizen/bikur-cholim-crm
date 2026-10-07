/**
 * Targets the director sets for the Impact page. Kept in code (not the
 * database) while there are only a couple; change them here.
 */
export const IMPACT_GOALS = {
  /** Share of residents we've met who have a family connection, or null
   * for no goal line (the director's choice for now, Oct 2026). `by` is a
   * YYYY-MM-DD deadline, or null. */
  familyConnection: { percent: null as number | null, by: null as string | null },
};
