/**
 * Interaction-related types and option lists. Must stay in sync with the
 * CHECK constraint in supabase/migrations/20260727000010_interactions.sql
 * — see the same note in src/lib/domain/facility.ts for why.
 */

export { labelFor } from "./options";

export const INTERACTION_TYPES = [
  { value: "resident_visit", label: "Resident visit" },
  { value: "resident_phone_call", label: "Phone call with resident" },
  { value: "family_communication", label: "Family communication" },
  { value: "facility_staff_communication", label: "Facility staff communication" },
  { value: "facility_discovery_visit", label: "Facility discovery visit" },
  { value: "volunteer_visit", label: "Volunteer visit" },
  { value: "program", label: "Program" },
  { value: "school_engagement", label: "School engagement" },
  { value: "kosher_food_coordination", label: "Kosher food coordination" },
  { value: "hospital_related_communication", label: "Hospital-related communication" },
  { value: "referral", label: "Referral" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number]["value"];

export type Interaction = {
  id: string;
  occurred_at: string;
  interaction_type: InteractionType;
  facility_id: string | null;
  resident_id: string | null;
  staff_member_id: string;
  notes: string | null;
  created_at: string;
};

/** An interaction row plus the resident/facility/contact/staff names needed
 * to display it in a list — see lib/queries/interactions.ts.
 *
 * `contact_id`/`contact_name` and `volunteers` are two different things
 * that must never be conflated in a display: `contact_id` is a single
 * general-purpose "who this was with" reference (e.g. a family member
 * for a family_communication, or facility staff for a
 * facility_staff_communication); `volunteers` is who's actually tagged,
 * via interaction_volunteers, as having been on a volunteer_visit. A
 * volunteer_visit's contact_id is not meaningful (some historical rows
 * even have it pointing at a resident's family contact) and should
 * never be shown as if it were the volunteer. */
export type InteractionWithNames = Interaction & {
  resident_name: string | null;
  facility_name: string | null;
  facility_cluster_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  staff_member_name: string | null;
  volunteers: { id: string; name: string }[];
};
