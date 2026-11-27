import { createClient } from "@/lib/supabase/server";
import { ACTIVE_RESIDENT_STATUSES, isActiveResidentStatus } from "@/lib/domain/resident";
import { currentQuarter } from "@/lib/report-period";
import { orgDayStartIso } from "@/lib/format-date";

export const NO_VISIT_DAYS = 30;

export type AttentionResident = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  status: string;
  current_facility_id: string | null;
  current_facility_name: string | null;
  last_visit_at: string | null;
  /** Newest visit, volunteer visit or phone call (Q3, Nov 3, 2026). */
  last_contact_at: string | null;
  /** Newest Attempted visit (Nov 27, 2026). */
  last_attempt_at: string | null;
};

/** Residents someone should look into, in three groups. Reads through
 * resident_summary, so each person only ever sees residents at the
 * facilities they have access to. Residents who are no longer active
 * (returned home, deceased, ...) are left out. */
export async function getNeedsAttention() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_summary")
    .select("id, first_name, last_name, preferred_name, status, current_facility_id, current_facility_name, last_visit_at, last_contact_at, last_attempt_at")
    .order("last_name", { ascending: true });
  if (error) throw new Error(error.message);

  const residents = ((data ?? []) as AttentionResident[]).filter((r) => isActiveResidentStatus(r.status));
  const cutoff = Date.now() - NO_VISIT_DAYS * 24 * 60 * 60 * 1000;

  // "Location unknown" is the status only; someone with no facility on
  // file (perhaps living at home) is listed apart, never assumed unknown
  // or at home (Q1, D1, Nov 3, 2026).
  const locationUnknown = residents.filter((r) => r.status === "location_unknown");
  const noFacility = residents.filter((r) => r.status !== "location_unknown" && !r.current_facility_id);
  const missingName = residents.filter((r) => !r.first_name?.trim() || !r.last_name?.trim());
  const noRecentVisit = residents
    .filter(
      (r) =>
        (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status) &&
        (!r.last_visit_at || new Date(r.last_visit_at).getTime() < cutoff)
    )
    // Never-visited first, then longest since the last visit.
    .sort((a, b) => (a.last_visit_at ?? "").localeCompare(b.last_visit_at ?? ""));

  // This quarter (Nov 27, 2026). Seen = a completed in-person visit. A
  // documented attempt clears the flag but is never "seen". Of those
  // neither seen nor tried, someone already called is listed apart from
  // someone with no contact at all, so a call can be reviewed for whether
  // a visit is still needed.
  const quarter = currentQuarter();
  const qStart = orgDayStartIso(quarter.from!)!;
  const inQuarter = (at: string | null) => !!at && at >= qStart;
  const current = residents.filter((r) => (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status) && !inQuarter(r.last_visit_at));
  const attemptedThisQuarter = current.filter((r) => inQuarter(r.last_attempt_at));
  const notTried = current.filter((r) => !inQuarter(r.last_attempt_at));
  const quarterNoContact = notTried.filter((r) => !inQuarter(r.last_contact_at));
  const quarterContactOnly = notTried.filter((r) => inQuarter(r.last_contact_at));

  return { locationUnknown, noFacility, missingName, noRecentVisit, quarter, attemptedThisQuarter, quarterNoContact, quarterContactOnly };
}
