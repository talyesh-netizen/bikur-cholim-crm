/**
 * Targets the director sets for the Impact page. Kept in code (not the
 * database) while there are only a couple; change them here.
 */
export const IMPACT_GOALS = {
  /** Share of residents we've met who have a family connection. `by` is a
   * YYYY-MM-DD deadline, or null until the director picks one. */
  familyConnection: { percent: 30, by: null as string | null },
};
