import { createClient } from "@/lib/supabase/server";
import type { ResidentWithSummary, ResidentFacilityHistoryEntry } from "@/lib/domain/resident";
import { escapeIlikeTerm, sanitizeForOrFilter } from "@/lib/supabase-filters";

// Hidden from the list by default (a "closed out" record), same idea as
// facilities defaulting to active-only — staff can reveal them with the
// "show all statuses" checkbox.
const DEFAULT_HIDDEN_STATUSES = ["deceased", "no_longer_receiving_services"];

export type ResidentFilters = {
  search?: string;
  facilityId?: string;
  status?: string;
  showAllStatuses?: boolean;
};

export async function listResidents(filters: ResidentFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("resident_summary")
    .select("*")
    .order("last_name", { ascending: true });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else if (!filters.showAllStatuses) {
    query = query.not("status", "in", `(${DEFAULT_HIDDEN_STATUSES.join(",")})`);
  }

  if (filters.search) {
    const term = `%${escapeIlikeTerm(sanitizeForOrFilter(filters.search))}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},preferred_name.ilike.${term}`);
  }
  if (filters.facilityId) {
    query = query.eq("current_facility_id", filters.facilityId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ResidentWithSummary[];
}

export async function getResident(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as ResidentWithSummary;
}

export async function getResidentFacilityHistory(residentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resident_facility_history")
    .select("id, facility_id, start_date, end_date, reason, created_at, facilities(name)")
    .eq("resident_id", residentId)
    // start_date is a plain date (no time of day), so two stays that
    // began the same calendar day would otherwise sort in an
    // unpredictable order -- created_at breaks the tie deterministically,
    // which matters here since the transfer page picks history[1] as
    // "the stay right before this one" for its one-click "Move back to"
    // shortcut.
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    facility_id: row.facility_id,
    facility_name: (row.facilities as unknown as { name: string } | null)?.name ?? "Unknown facility",
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason,
  })) as ResidentFacilityHistoryEntry[];
}
