import type { InteractionType } from "@/lib/domain/interaction";

/**
 * Pure counting logic for the Daily Activity Summary -- kept apart from
 * the database queries (lib/queries/daily-summary.ts) so the numbers can
 * be checked without a database. Everything here is derived from CRM
 * records; nothing is estimated or remembered from elsewhere.
 */

/** One logged interaction on the day, with just enough to count and
 * display it. Deliberately no `notes` -- the summary never shows note
 * text (see ROADMAP.md, "Privacy Rules"). */
export type DayInteraction = {
  id: string;
  occurred_at: string;
  interaction_type: InteractionType;
  resident_id: string | null;
  resident_name: string | null;
  facility_id: string | null;
  facility_name: string | null;
  staff_member_name: string | null;
  quantity: number | null;
  people_reached: number | null;
  participants: number | null;
  funder_story: boolean;
  unmet_need: boolean;
  volunteer_count: number;
};

export type DayRecord = { id: string; label: string; href: string };

/** Face-to-face resident contact -- what "residents visited" means. */
export const VISIT_TYPES: readonly InteractionType[] = ["resident_visit", "volunteer_visit"];
export const PROGRAM_TYPES: readonly InteractionType[] = ["program", "school_engagement"];

export type DailySummary = {
  totalEntries: number;
  residentsVisited: number;
  residentsReached: number;
  facilitiesWithActivity: number;
  staffInteractions: number;
  volunteerVisits: number;
  volunteerVisitsUntagged: number;
  foodDeliveries: number;
  foodItemsDelivered: number;
  programs: number;
  programAttendance: number;
  funderStories: number;
  unmetNeeds: number;
  followUpsCreated: number;
  newResidents: number;
  newFacilities: number;
  residentMoves: number;
  byType: { type: InteractionType; count: number }[];
  byFacility: { facilityId: string | null; facilityName: string; interactions: DayInteraction[] }[];
};

const sum = (values: (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);
const distinct = (values: (string | null)[]) => new Set(values.filter((v): v is string => v !== null)).size;

export function summarizeDay(input: {
  interactions: DayInteraction[];
  tasksCreated: number;
  newResidents: number;
  newFacilities: number;
  residentMoves: number;
}): DailySummary {
  const { interactions } = input;
  const ofType = (types: readonly InteractionType[]) => interactions.filter((i) => types.includes(i.interaction_type));

  const volunteerVisits = ofType(["volunteer_visit"]);
  const foodDeliveries = ofType(["food_delivery"]);
  const programs = ofType(PROGRAM_TYPES);

  const typeCounts = new Map<InteractionType, number>();
  for (const i of interactions) typeCounts.set(i.interaction_type, (typeCounts.get(i.interaction_type) ?? 0) + 1);

  // Group by facility for the "where we were" list; entries with no
  // facility (e.g. care navigation for a family) get their own group,
  // shown last.
  const groups = new Map<string, { facilityId: string | null; facilityName: string; interactions: DayInteraction[] }>();
  for (const i of interactions) {
    const key = i.facility_id ?? "none";
    if (!groups.has(key)) {
      groups.set(key, {
        facilityId: i.facility_id,
        facilityName: i.facility_id ? i.facility_name ?? "Facility" : "No facility",
        interactions: [],
      });
    }
    groups.get(key)!.interactions.push(i);
  }
  const byFacility = Array.from(groups.values())
    .map((g) => ({ ...g, interactions: [...g.interactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)) }))
    .sort((a, b) => {
      if (a.facilityId === null) return 1;
      if (b.facilityId === null) return -1;
      return a.facilityName.localeCompare(b.facilityName);
    });

  return {
    totalEntries: interactions.length,
    residentsVisited: distinct(ofType(VISIT_TYPES).map((i) => i.resident_id)),
    residentsReached: distinct(interactions.map((i) => i.resident_id)),
    facilitiesWithActivity: distinct(interactions.map((i) => i.facility_id)),
    staffInteractions: ofType(["facility_staff_communication"]).length,
    volunteerVisits: volunteerVisits.length,
    volunteerVisitsUntagged: volunteerVisits.filter((i) => i.volunteer_count === 0).length,
    foodDeliveries: foodDeliveries.length,
    foodItemsDelivered: sum(foodDeliveries.map((i) => i.quantity)),
    programs: programs.length,
    programAttendance: sum(programs.map((i) => i.people_reached)),
    funderStories: interactions.filter((i) => i.funder_story).length,
    unmetNeeds: interactions.filter((i) => i.unmet_need).length,
    followUpsCreated: input.tasksCreated,
    newResidents: input.newResidents,
    newFacilities: input.newFacilities,
    residentMoves: input.residentMoves,
    byType: Array.from(typeCounts, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byFacility,
  };
}
