/**
 * Resident-related types and option lists. Must stay in sync with the
 * CHECK constraint in
 * supabase/migrations/20260910185959_residents.sql — see the same note
 * in src/lib/domain/facility.ts for why.
 */

export { labelFor } from "./options";

export const RESIDENT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "temporarily_hospitalized", label: "Temporarily hospitalized" },
  { value: "moved_to_another_facility", label: "Moved to another facility" },
  { value: "returned_home", label: "Returned home" },
  { value: "deceased", label: "Deceased" },
  { value: "unable_to_reach", label: "Unable to reach" },
  { value: "no_longer_receiving_services", label: "No longer receiving services" },
] as const;

export type ResidentStatus = (typeof RESIDENT_STATUSES)[number]["value"];

/** Statuses that represent someone still actively being served — used
 * to decide default list filtering and dashboard counts later. */
export const ACTIVE_RESIDENT_STATUSES: ResidentStatus[] = [
  "active",
  "temporarily_hospitalized",
];

export type Resident = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  current_facility_id: string;
  room_number: string | null;
  phone_number: string | null;
  rabbi_synagogue_connection: string | null;
  jewish_interests_background: string | null;
  kosher_food_needs: string | null;
  holiday_support_needs: string | null;
  visitation_needs: string | null;
  preferred_visit_frequency: string | null;
  status: ResidentStatus;
  private_internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** A resident row as returned by the resident_summary view — the real
 * residents table plus computed fields. See
 * supabase/migrations/20260910190104_computed_views.sql. */
export type ResidentWithSummary = Resident & {
  current_facility_name: string | null;
  last_visit_at: string | null;
  next_follow_up_date: string | null;
  primary_contact_resident_contact_id: string | null;
};

export type ResidentFacilityHistoryEntry = {
  id: string;
  facility_id: string;
  facility_name: string;
  start_date: string;
  end_date: string | null;
  reason: string | null;
};
