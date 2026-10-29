import { createClient } from "@/lib/supabase/server";
import { orgDayKey } from "@/lib/format-date";
import { selectAllPages } from "@/lib/queries/impact";
import { PARTNER_CONTACT_TYPES } from "@/lib/domain/contact";

/**
 * How activities are counted (Build 2, approved by the director Oct 16,
 * 2026). Kept in one place so every report counts the same way.
 *
 * - Each activity counts once. An entry an admin reviewed as "Same visit"
 *   (counted_in_id set) or that someone voided is skipped; nothing is ever
 *   skipped without a person's answer.
 * - Staff interactions (director, Oct 27, 2026): each facility staff
 *   person spoken with counts once per entry -- one record per person
 *   from now on, and an older entry with four staff on it counts four.
 *   There is no separate "meetings" number. A staff conversation with
 *   nobody named still counts one; a first visit to a new facility, a
 *   program or anything else counts only the staff actually met. Staff
 *   people: each different person met, once per period.
 * - Partner conversations (Oct 27, 2026): the same, for people filed as
 *   partners (PARTNER_CONTACT_TYPES) on a staff conversation or an
 *   "Other" entry -- counted on their own line, never as facility staff
 *   support. Decided by how the person is filed now, so past periods use
 *   it too; saved entries are never changed.
 * - Staff visits (Oct 27, 2026): each staff member (lead or team) once
 *   per facility per Cleveland day they were there in person -- shown
 *   beside the facility visit-days below. Volunteer-only visits give no
 *   staff credit.
 * - Facility presence (decisions D2, Oct 19, and Oct 21, 2026), each
 *   facility once per Cleveland calendar day: staff visit-days (our staff
 *   there in person), volunteer-only days (volunteers there, no staff),
 *   and total presence (either). Phone, email and video never make one,
 *   and neither does an entry with no facility (a program at a school).
 *   An entry whose method was never recorded counts as in person only
 *   when it can only happen in person (a visit, program, delivery or
 *   first visit) -- never assumed for a conversation.
 * - Program head counts: students and volunteers (asked separately from
 *   Oct 27, 2026), and an older entry's single number as "not split",
 *   held on a group project's first activity; activities "Part of" it
 *   never add them again.
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

/** Staff conversations and "Other" entries: with a partner, a partner
 * conversation. */
export const PARTNER_CONVERSATION_TYPES = new Set(["facility_staff_communication", "other"]);

export type CountableRow = {
  id: string;
  interaction_type: string;
  occurred_at: string;
  facility_id: string | null;
  contact_id: string | null;
  /** Who did it (the lead); team members come from TeamLinks. */
  staff_member_id?: string | null;
  participants?: number | null;
  student_count?: number | null;
  volunteer_count?: number | null;
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

/** The people filed as partners (PARTNER_CONTACT_TYPES), by id. */
export type PartnerContacts = Set<string>;

export async function fetchPartnerContacts(supabase: Client): Promise<PartnerContacts> {
  const rows = await selectAllPages<{ id: string }>((from, to) =>
    supabase.from("contacts").select("id").in("contact_type", [...PARTNER_CONTACT_TYPES]).order("id").range(from, to)
  );
  return new Set(rows.map((r) => r.id));
}

/** Everyone met on one activity: its own contact for a staff
 * conversation, first visit or "Other" entry, plus anyone marked
 * "worked with". */
function peopleMetOn(r: CountableRow, engaged: EngagedLinks): Set<string> {
  const people = new Set(engaged.get(r.id) ?? []);
  if ((STAFF_SUPPORT_TYPES.has(r.interaction_type) || r.interaction_type === "other") && r.contact_id) people.add(r.contact_id);
  return people;
}

/** The facility staff met on one activity (never partners, and nobody on
 * an "Other" entry). */
export function staffPeopleOn(r: CountableRow, engaged: EngagedLinks, partners: PartnerContacts): Set<string> {
  if (r.interaction_type === "other") return new Set();
  return new Set([...peopleMetOn(r, engaged)].filter((p) => !partners.has(p)));
}

/** The partners spoken with on a staff conversation or "Other" entry. */
export function partnerPeopleOn(r: CountableRow, engaged: EngagedLinks, partners: PartnerContacts): Set<string> {
  if (!PARTNER_CONVERSATION_TYPES.has(r.interaction_type)) return new Set();
  return new Set([...peopleMetOn(r, engaged)].filter((p) => partners.has(p)));
}

/** Staff interactions on this activity: one per facility staff person
 * met, and one for a staff conversation with nobody named (see above). */
export function staffInteractionFor(r: CountableRow, engaged: EngagedLinks, partners: PartnerContacts): number {
  const staff = staffPeopleOn(r, engaged, partners).size;
  if (r.interaction_type === "facility_staff_communication" && staff === 0 && partnerPeopleOn(r, engaged, partners).size === 0) return 1;
  return staff;
}

/** Partner conversations on this activity: one per partner spoken with. */
export function partnerConversationsFor(r: CountableRow, engaged: EngagedLinks, partners: PartnerContacts): number {
  return partnerPeopleOn(r, engaged, partners).size;
}

/** Staff interactions in a set of activities, and the different people met. */
export function staffInteractions(
  rows: CountableRow[],
  engaged: EngagedLinks,
  partners: PartnerContacts
): { interactions: number; people: number } {
  let interactions = 0;
  const people = new Set<string>();
  for (const r of rows) {
    interactions += staffInteractionFor(r, engaged, partners);
    staffPeopleOn(r, engaged, partners).forEach((p) => people.add(p));
  }
  return { interactions, people: people.size };
}

/** interaction id -> the Bikur Cholim staff on its team (besides its lead). */
export type TeamLinks = Map<string, string[]>;

export async function fetchTeamLinks(supabase: Client): Promise<TeamLinks> {
  const rows = await selectAllPages<{ interaction_id: string; profile_id: string }>((from, to) =>
    supabase
      .from("interaction_team_members")
      .select("interaction_id, profile_id")
      .order("interaction_id")
      .order("profile_id")
      .range(from, to)
  );
  const links: TeamLinks = new Map();
  for (const r of rows) links.set(r.interaction_id, [...(links.get(r.interaction_id) ?? []), r.profile_id]);
  return links;
}

/** Staff visits: each staff member (lead or team) once per facility per
 * Cleveland day they were there in person. Volunteer visits never. */
export function staffVisits(rows: CountableRow[], team: TeamLinks): number {
  const visits = new Set<string>();
  for (const r of rows) {
    const day = visitDayKey(r);
    if (!day) continue;
    for (const person of new Set([r.staff_member_id, ...(team.get(r.id) ?? [])])) {
      if (person) visits.add(`${person}|${day}`);
    }
  }
  return visits.size;
}

/** Whether our staff were at the facility in person: the method when one was
 * recorded ("In person elsewhere" never); otherwise only for entries that
 * can't happen any other way. */
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

export type GroupCounts = { students: number; volunteers: number; notSplit: number };

/** The program head counts this activity holds (all 0 when it's part of
 * another activity's project, or isn't a group project): students and
 * volunteers, and an older entry's single number, not split. */
export function groupCountsFor(r: CountableRow): GroupCounts {
  if (r.part_of_id || !GROUP_PROJECT_TYPES.has(r.interaction_type)) return { students: 0, volunteers: 0, notSplit: 0 };
  return { students: r.student_count ?? 0, volunteers: r.volunteer_count ?? 0, notSplit: r.participants ?? 0 };
}
