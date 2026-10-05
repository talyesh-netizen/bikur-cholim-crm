/**
 * Interaction-related types and option lists. Must stay in sync with the
 * CHECK constraint in supabase/migrations/20260727000010_interactions.sql
 * — see the same note in src/lib/domain/facility.ts for why.
 */

export { labelFor } from "./options";

export const INTERACTION_TYPES = [
  { value: "resident_visit", label: "Resident visit" },
  { value: "volunteer_visit", label: "Volunteer visit" },
  { value: "resident_phone_call", label: "Phone call with resident" },
  { value: "family_communication", label: "Family support" },
  { value: "care_navigation", label: "Care navigation (helping a family find care)" },
  { value: "food_delivery", label: "Delivery (food, Shabbos & holiday packages)" },
  { value: "kosher_food_coordination", label: "Kosher food coordination" },
  { value: "program", label: "Program / event" },
  { value: "school_engagement", label: "School & shul program" },
  { value: "medical_referral", label: "Medical referral (to Bikur Cholim)" },
  { value: "ride_arranged", label: "Ride arranged (through Bikur Cholim)" },
  { value: "referral", label: "Referral (other)" },
  { value: "facility_staff_communication", label: "Facility staff (meeting, touchpoint, appreciation)" },
  { value: "facility_discovery_visit", label: "First visit to a new facility" },
  { value: "hospital_related_communication", label: "Hospital-related communication" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number]["value"];

/** The simple picker on the log form: 8 big buttons. A button that
 * covers more than one stored type asks a short follow-up (its
 * `choices`); the first choice is the default. Every stored type stays
 * valid for old records and reports -- this only changes what's offered. */
export const TYPE_BUTTONS: {
  key: string;
  label: string;
  choices: { value: InteractionType; label: string }[];
}[] = [
  { key: "resident_visit", label: "Resident visit", choices: [{ value: "resident_visit", label: "Resident visit" }] },
  { key: "phone", label: "Phone call", choices: [{ value: "resident_phone_call", label: "Phone call" }] },
  { key: "volunteer", label: "Volunteer visit", choices: [{ value: "volunteer_visit", label: "Volunteer visit" }] },
  { key: "family", label: "Family support", choices: [{ value: "family_communication", label: "Family support" }] },
  {
    key: "facility",
    label: "Facility staff",
    choices: [
      { value: "facility_staff_communication", label: "Meeting, touchpoint or appreciation" },
      { value: "facility_discovery_visit", label: "First visit to a new facility" },
    ],
  },
  { key: "program", label: "Program / event", choices: [{ value: "program", label: "Program / event" }] },
  { key: "delivery", label: "Delivery", choices: [{ value: "food_delivery", label: "Delivery" }] },
  {
    key: "referral",
    label: "Referral",
    choices: [
      { value: "medical_referral", label: "Medical" },
      { value: "ride_arranged", label: "Ride" },
      { value: "referral", label: "Other" },
    ],
  },
];

/** Offered under "More types". Types not listed here or in TYPE_BUTTONS
 * (school & shul, care navigation, hospital, email) are no longer
 * offered for new entries, but still show for old ones. */
export const MORE_TYPES: InteractionType[] = ["kosher_food_coordination", "other"];

/** Which holiday an activity was for. The year comes from the date, so
 * "Purim program '26" is just Program + Purim -- the list never grows. */
export const HOLIDAYS = [
  { value: "shabbos", label: "Shabbos" },
  { value: "rosh_hashana", label: "Rosh Hashana" },
  { value: "yom_kippur", label: "Yom Kippur" },
  { value: "sukkos", label: "Sukkos" },
  { value: "chanukah", label: "Chanukah" },
  { value: "tu_bshvat", label: "Tu B'Shvat" },
  { value: "purim", label: "Purim" },
  { value: "pesach", label: "Pesach" },
  { value: "shavuos", label: "Shavuos" },
] as const;

/** What a family needed, picked when logging Family support. */
export const FAMILY_NEEDS = [
  { value: "update", label: "Update on their loved one" },
  { value: "emotional_support", label: "Emotional support" },
  { value: "referral", label: "Referral / connecting to help" },
  { value: "finding_care", label: "Finding care or placement" },
  { value: "other", label: "Something else" },
] as const;

/** Types that ask "What did the family need?". */
export const FAMILY_NEED_TYPES: readonly string[] = ["family_communication"];

/** Types that ask "Which holiday?". */
export const HOLIDAY_TYPES: readonly string[] = [
  "resident_visit",
  "volunteer_visit",
  "program",
  "food_delivery",
  "school_engagement",
];

/** The older Shabbos / Yom Tov "occasion" (still used by the funder
 * report's food numbers), worked out from the holiday. */
export function occasionForHoliday(holiday: string | null | undefined): "shabbos" | "yom_tov" | null {
  if (!holiday) return null;
  return holiday === "shabbos" ? "shabbos" : "yom_tov";
}

export type Interaction = {
  id: string;
  occurred_at: string;
  interaction_type: InteractionType;
  facility_id: string | null;
  resident_id: string | null;
  staff_member_id: string;
  notes: string | null;
  created_at: string;
} & ServiceDetails;

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

/** Types where the facility can be left blank -- e.g. a family calling
 * for help finding a facility for their father doesn't have one yet. */
export const FACILITY_OPTIONAL_TYPES: readonly string[] = ["care_navigation"];

export const OCCASIONS = [
  { value: "regular", label: "Regular / weekday" },
  { value: "shabbos", label: "Shabbos" },
  { value: "yom_tov", label: "Yom Tov / holiday" },
  { value: "other", label: "Other occasion" },
] as const;

export const PROGRAM_PARTNERS = [
  { value: "school", label: "School" },
  { value: "shul", label: "Shul" },
] as const;

export const UNMET_NEED_REASONS = [
  { value: "no_volunteer", label: "No volunteer available" },
  { value: "not_enough_supplies", label: "Not enough food or supplies" },
  { value: "no_staff_time", label: "Not enough staff time" },
  { value: "outside_our_area", label: "Outside our area / what we offer" },
  { value: "other", label: "Other" },
] as const;

/** Time-spent choices, in minutes -- a dropdown rather than a free
 * number so logging stays one tap on a phone. */
export const TIME_SPENT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1½ hours" },
  { value: "120", label: "2 hours" },
  { value: "180", label: "3 hours" },
  { value: "240", label: "4 hours" },
  { value: "360", label: "6 hours" },
  { value: "480", label: "A full day" },
] as const;

/** Which optional service fields each activity type asks about. Time
 * spent, "couldn't fully meet this request", and "good story for
 * funders" apply to every type, so they aren't listed here. Anything a
 * type doesn't ask about is cleared on save (see lib/actions/interactions.ts),
 * so switching an entry's type can't leave stale numbers behind that
 * would still be counted in the impact report. */
export const SERVICE_FIELDS_BY_TYPE: Partial<
  Record<InteractionType, readonly ("occasion" | "program_partner" | "quantity" | "people_reached" | "participants")[]>
> = {
  food_delivery: ["occasion", "quantity", "people_reached"],
  program: ["occasion", "people_reached"],
  school_engagement: ["program_partner", "occasion", "participants", "people_reached"],
  // Group visits: the old tracking sheet logged e.g. "1 to 1 Pesach visit,
  // 15 residents" or a volunteer group seeing 7 people as one entry.
  resident_visit: ["people_reached"],
  volunteer_visit: ["people_reached"],
};

/** Types where "Residents reached" means a group visit -- one person is
 * the normal case, so the form says to leave it blank for that. */
export const GROUP_VISIT_TYPES: readonly string[] = ["resident_visit", "volunteer_visit"];

export type ServiceDetails = {
  occasion: string | null;
  holiday: string | null;
  family_need: string | null;
  program_partner: string | null;
  quantity: number | null;
  people_reached: number | null;
  participants: number | null;
  minutes_spent: number | null;
  unmet_need: boolean;
  unmet_need_reason: string | null;
  funder_story: boolean;
};

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr${hours === 1 ? "" : "s"}`;
}
