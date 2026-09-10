/**
 * Facility-related types and option lists. These option lists must stay
 * in sync with the CHECK constraints in
 * supabase/migrations/20260910185951_facilities.sql — the database is
 * the ultimate source of truth (it will reject anything not in these
 * lists), but keeping them mirrored here is what lets the app show
 * plain-English labels and dropdowns instead of raw database codes.
 */

export const FACILITY_TYPES = [
  { value: "nursing_home", label: "Nursing home" },
  { value: "assisted_living", label: "Assisted living" },
  { value: "rehabilitation_center", label: "Rehabilitation center" },
  { value: "memory_care", label: "Memory care" },
  { value: "independent_living", label: "Independent living" },
  { value: "senior_apartment", label: "Senior apartment building" },
  { value: "hospital", label: "Hospital" },
  { value: "other", label: "Other" },
] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number]["value"];

export const ENGAGEMENT_STATUSES = [
  { value: "not_contacted", label: "Not contacted" },
  { value: "initial_contact", label: "Initial contact made" },
  { value: "staff_relationship_developing", label: "Staff relationship developing" },
  { value: "active_facility", label: "Active facility" },
  { value: "recurring_visits", label: "Recurring visits" },
  { value: "recurring_programming", label: "Recurring programming" },
  { value: "no_known_jewish_residents", label: "No Jewish residents currently known" },
  { value: "follow_up_needed", label: "Follow up needed" },
] as const;

export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number]["value"];

export const VISIT_PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export type VisitPriority = (typeof VISIT_PRIORITIES)[number]["value"];

export const KOSHER_FOOD_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "some_options", label: "Some options" },
  { value: "unknown", label: "Unknown" },
] as const;

export type KosherFoodAvailability = (typeof KOSHER_FOOD_OPTIONS)[number]["value"];

/** Looks up the plain-English label for a stored option value. Falls
 * back to the raw value itself if it's ever somehow not in the list,
 * rather than showing nothing. */
export { labelFor } from "./options";

export type GeographicCluster = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
};

export type Facility = {
  id: string;
  name: string;
  facility_type: FacilityType;
  address: string | null;
  city: string | null;
  zip: string | null;
  main_phone: string | null;
  website: string | null;
  parent_healthcare_group: string | null;
  geographic_cluster_id: string | null;
  approx_jewish_resident_count: number | null;
  jewish_residents_currently_known: boolean;
  engagement_status: EngagementStatus;
  visit_priority: VisitPriority;
  recommended_visit_frequency: string | null;
  kosher_food_availability: KosherFoodAvailability | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** A facility row as returned by the facility_summary view — the real
 * facilities table plus computed fields. See
 * supabase/migrations/20260910190104_computed_views.sql. */
export type FacilityWithSummary = Facility & {
  geographic_cluster_name: string | null;
  last_visit_at: string | null;
  active_resident_count: number;
};
