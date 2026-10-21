import { createClient } from "@/lib/supabase/server";
import { orgDayKey } from "@/lib/format-date";
import { selectAllPages } from "@/lib/queries/impact";

/**
 * How activities are counted (Build 2, approved by the director Oct 16,
 * 2026). Kept in one place so every report counts the same way.
 *
 * - Each activity counts once. An entry an admin reviewed as "Same visit"
 *   (counted_in_id set) or that someone voided is skipped; nothing is ever
 *   skipped without a person's answer.
 * - Staff interactions (director, Oct 21, 2026): each distinct staff
 *   meeting or conversation counts once, however many staff were in it --
 *   a meeting with four staff is one meeting with four people. A staff
 *   conversation always counts; a first visit to a new facility, a
 *   program or anything else counts only when someone was actually met
 *   (a person on it, or "Staff you worked with"). Staff people: each
 *   different person met, once per period.
 * - Facility presence (decisions D2, Oct 19, and Oct 21, 2026), each
 *   facility once per Cleveland calendar day: staff visit-days (our staff
 *   there in person), volunteer-only days (volunteers there, no staff),
 *   and total presence (either). Phone, email and video never make one,
 *   and neither does an entry with no facility (a program at a school).
 *   An entry whose method was never recorded counts as in person only
 *   when it can only happen in person (a visit, program, delivery or
 *   first visit) -- never assumed for a conversation.
 * - Group volunteers: a group project's head count, held on its first
 *   activity; activities "Part of" it never add it again.
 */

type Client = Awaited<ReturnType<typeof createClient>>;

/** Staff calls, meetings and discovery visits: always at least one engagement. */
export const STAFF_SUPPORT_TYPES = new Set(["facility_staff_communication", "facility_discovery_visit"]);

/** Staff in person at a facility -- what makes a "visit-day". Not
 * volunteer visits (no staff there) and never calls. */
export const VISIT_DAY_TYPES = new Set([
  "resident_visit",
  "facility_visit",
  "facility_discovery_visit",
  "program",
  "school_engagement",
  "food_delivery",
]);

/** Activities that can hold a group's volunteer head count. */
export const GROUP_PROJECT_TYPES = new Set(["program", "school_engagement"]);

export type CountableRow = {
  id: string;
  interaction_type: string;
  occurred_at: string;
  facility_id: string | null;
  contact_id: string | null;
  participants?: number | null;
  part_of_id?: string | null;
  counted_in_id?: string | null;
  in_person?: boolean | null;
  method?: string | null;
  voided_at?: string | null;
};

/** Not reviewed as a copy of another entry, and not voided. */
export const isCounted = (r: { counted_in_id?: string | null; voided_at?: string | null }) => !r.counted_in_id && !r.voided_at;

/** interaction id -> the staff contacts engaged on it. */
export type EngagedLinks = Map<string, Set<string>>;

export async function fetchEngagedLinks(supabase: Client, fromIso: string | null): Promise<EngagedLinks> {
  const rows = await selectAllPages<{ interaction_id: string; contact_id: string; interactions: { occurred_at: string } | null }>(
    (from, to) =>
      supabase
        .from("interaction_contacts")
        .select("interaction_id, contact_id, interactions(occurred_at)")
        .eq("engaged", true)
        .order("interaction_id")
        .order("contact_id")
        .range(from, to) as unknown as PromiseLike<{
        data: { interaction_id: string; contact_id: string; interactions: { occurred_at: string } | null }[] | null;
        error: { message: string } | null;
      }>
  );
  const links: EngagedLinks = new Map();
  for (const r of rows) {
    if (fromIso && (!r.interactions || r.interactions.occurred_at < fromIso)) continue;
    const set = links.get(r.interaction_id) ?? new Set<string>();
    set.add(r.contact_id);
    links.set(r.interaction_id, set);
  }
  return links;
}

/** The staff people met on one activity: its own contact for a staff
 * conversation or first visit, plus anyone marked "worked with". */
export function staffPeopleOn(r: CountableRow, engaged: EngagedLinks): Set<string> {
  const people = new Set(engaged.get(r.id) ?? []);
  if (STAFF_SUPPORT_TYPES.has(r.interaction_type) && r.contact_id) people.add(r.contact_id);
  return people;
}

/** 1 when this activity was a staff interaction, else 0 (see above). */
export function staffInteractionFor(r: CountableRow, engaged: EngagedLinks): number {
  if (r.interaction_type === "facility_staff_communication") return 1;
  return staffPeopleOn(r, engaged).size > 0 ? 1 : 0;
}

/** Staff interactions in a set of activities, and the different people met. */
export function staffInteractions(rows: CountableRow[], engaged: EngagedLinks): { interactions: number; people: number } {
  let interactions = 0;
  const people = new Set<string>();
  for (const r of rows) {
    interactions += staffInteractionFor(r, engaged);
    staffPeopleOn(r, engaged).forEach((p) => people.add(p));
  }
  return { interactions, people: people.size };
}

/** Whether our staff were there in person: the method when one was
 * recorded; otherwise only for entries that can't happen any other way. */
export function staffInPerson(r: CountableRow): boolean {
  if (r.interaction_type === "volunteer_visit") return false;
  if (r.method) return r.method === "in_person";
  if (r.in_person === true) return true;
  return VISIT_DAY_TYPES.has(r.interaction_type);
}

/** "facility|2026-10-09" for an in-person staff activity at a facility, else null. */
export function visitDayKey(r: CountableRow): string | null {
  if (!r.facility_id || !staffInPerson(r)) return null;
  return `${r.facility_id}|${orgDayKey(r.occurred_at)}`;
}

/** "facility|2026-10-09" for a volunteer visit at a facility, else null. */
export function volunteerDayKey(r: CountableRow): string | null {
  if (!r.facility_id || r.interaction_type !== "volunteer_visit") return null;
  if (r.method && r.method !== "in_person") return null;
  return `${r.facility_id}|${orgDayKey(r.occurred_at)}`;
}

export type FacilityPresence = {
  /** Facility-days our staff were there in person. */
  staffVisitDays: number;
  /** Facility-days only volunteers were there. */
  volunteerOnlyDays: number;
  /** Facility-days anyone from Bikur Cholim was there (the two above). */
  presenceDays: number;
  /** Different facilities with at least one presence day. */
  facilitiesVisited: number;
  /** Different facilities with any entry at all, calls included. */
  facilitiesEngaged: number;
};

/** The four facility numbers for a set of counted activities. */
export function facilityPresence(rows: CountableRow[]): FacilityPresence {
  const staff = new Set<string>();
  const volunteer = new Set<string>();
  const engaged = new Set<string>();
  for (const r of rows) {
    if (r.facility_id) engaged.add(r.facility_id);
    const s = visitDayKey(r);
    if (s) staff.add(s);
    const v = volunteerDayKey(r);
    if (v) volunteer.add(v);
  }
  const presence = new Set([...staff, ...volunteer]);
  return {
    staffVisitDays: staff.size,
    volunteerOnlyDays: [...volunteer].filter((k) => !staff.has(k)).length,
    presenceDays: presence.size,
    facilitiesVisited: new Set([...presence].map((k) => k.split("|")[0])).size,
    facilitiesEngaged: engaged.size,
  };
}

/** The group volunteer head count this activity holds (0 when it's part
 * of another activity's project, or isn't a group project). */
export function groupVolunteersFor(r: CountableRow): number {
  if (r.part_of_id || !GROUP_PROJECT_TYPES.has(r.interaction_type)) return 0;
  return r.participants ?? 0;
}
