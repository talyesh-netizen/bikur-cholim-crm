import { createClient } from "@/lib/supabase/server";
import { orgDayKey } from "@/lib/format-date";
import { selectAllPages } from "@/lib/queries/impact";

/**
 * How activities are counted (Build 2, approved by the director Oct 16,
 * 2026). Kept in one place so every report counts the same way.
 *
 * - Each activity counts once. An entry an admin reviewed as "Same visit"
 *   (counted_in_id set) is skipped; nothing is ever skipped without that
 *   review.
 * - Staff engagements: each facility staff contact marked "worked with or
 *   spoke to" on an activity counts once for it. A staff call or meeting
 *   with no one named still counts 1. People only present count 0.
 * - Facility visit-days: each facility once per Cleveland calendar day it
 *   had an in-person activity.
 * - Group volunteers: a group project's head count, held on its first
 *   activity; activities "Part of" it never add it again.
 */

type Client = Awaited<ReturnType<typeof createClient>>;

/** Staff calls, meetings and discovery visits: always at least one engagement. */
export const STAFF_SUPPORT_TYPES = new Set(["facility_staff_communication", "facility_discovery_visit"]);

/** In-person activity at a facility -- what makes a "visit-day". */
export const VISIT_DAY_TYPES = new Set([
  "resident_visit",
  "volunteer_visit",
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
};

/** Not reviewed as a copy of another entry. */
export const isCounted = (r: { counted_in_id?: string | null }) => !r.counted_in_id;

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

/** Staff engagements one activity adds. */
export function staffEngagementsFor(r: CountableRow, engaged: EngagedLinks): number {
  const people = new Set(engaged.get(r.id) ?? []);
  if (STAFF_SUPPORT_TYPES.has(r.interaction_type)) {
    // The entry's own contact is who the call or meeting was with.
    if (r.contact_id) people.add(r.contact_id);
    return Math.max(people.size, 1);
  }
  return people.size;
}

/** "facility|2026-10-09" for an in-person activity at a facility, else null. */
export function visitDayKey(r: CountableRow): string | null {
  if (!r.facility_id || !VISIT_DAY_TYPES.has(r.interaction_type)) return null;
  return `${r.facility_id}|${orgDayKey(r.occurred_at)}`;
}

/** The group volunteer head count this activity holds (0 when it's part
 * of another activity's project, or isn't a group project). */
export function groupVolunteersFor(r: CountableRow): number {
  if (r.part_of_id || !GROUP_PROJECT_TYPES.has(r.interaction_type)) return 0;
  return r.participants ?? 0;
}
