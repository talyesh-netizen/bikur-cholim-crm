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

/** An interaction row plus the resident/facility/staff names needed to
 * display it in a list — see lib/queries/interactions.ts. */
export type InteractionWithNames = Interaction & {
  resident_name: string | null;
  facility_name: string | null;
  staff_member_name: string | null;
};
