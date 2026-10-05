import { createClient } from "@/lib/supabase/server";
import { ACTIVE_RESIDENT_STATUSES, isActiveResidentStatus } from "@/lib/domain/resident";

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
};

/** Residents someone should look into, in three groups. Reads through
 * resident_summary, so each person only ever sees residents at the
 * facilities they have access to. Residents who are no longer active
 * (returned home, deceased, ...) are left out. */
export async function getNeedsAttention() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_summary")
    .select("id, first_name, last_name, preferred_name, status, current_facility_id, current_facility_name, last_visit_at")
    .order("last_name", { ascending: true });
  if (error) throw new Error(error.message);

  const residents = ((data ?? []) as AttentionResident[]).filter((r) => isActiveResidentStatus(r.status));
  const cutoff = Date.now() - NO_VISIT_DAYS * 24 * 60 * 60 * 1000;

  const locationUnknown = residents.filter((r) => r.status === "location_unknown" || !r.current_facility_id);
  const missingName = residents.filter((r) => !r.first_name?.trim() || !r.last_name?.trim());
  const noRecentVisit = residents
    .filter(
      (r) =>
        (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status) &&
        (!r.last_visit_at || new Date(r.last_visit_at).getTime() < cutoff)
    )
    // Never-visited first, then longest since the last visit.
    .sort((a, b) => (a.last_visit_at ?? "").localeCompare(b.last_visit_at ?? ""));

  return { locationUnknown, missingName, noRecentVisit };
}
