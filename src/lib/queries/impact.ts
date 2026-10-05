import { createClient } from "@/lib/supabase/server";
import type { InteractionType } from "@/lib/domain/interaction";
import { orgDayStartIso, orgMonthStart, orgMonthKey } from "@/lib/format-date";

export const pad2 = (n: number) => String(n).padStart(2, "0");

export type ImpactPeriod = "month" | "quarter" | "all";

export type ImpactBucket = {
  key: string;
  label: string;
  color: string;
  count: number;
};

// Every interaction_type maps to exactly one bucket. Order here is the
// fixed categorical order the donut renders in — see the dataviz
// skill's palette.md: color identity follows the entity, in a fixed
// order, never reassigned when a filter changes which buckets are
// non-zero.
const BUCKET_DEFS: { key: string; label: string; color: string; types: InteractionType[] }[] = [
  { key: "resident_visits", label: "Resident visits & calls", color: "#2a78d6", types: ["resident_visit", "resident_phone_call"] },
  { key: "facility_staff", label: "Facility & staff", color: "#eb6834", types: ["facility_staff_communication", "facility_discovery_visit"] },
  { key: "programs", label: "Programs (facility, school & shul)", color: "#1baf7a", types: ["program", "school_engagement"] },
  { key: "volunteers", label: "Volunteer visits", color: "#e34948", types: ["volunteer_visit"] },
  { key: "food", label: "Food", color: "#eda100", types: ["food_delivery", "kosher_food_coordination"] },
  { key: "family", label: "Families & care navigation", color: "#e87ba4", types: ["family_communication", "care_navigation"] },
  { key: "referrals", label: "Referrals & rides", color: "#008300", types: ["medical_referral", "ride_arranged", "referral", "hospital_related_communication"] },
  { key: "other", label: "Other", color: "#4a3aa7", types: ["email", "other"] },
];

// PostgREST caps every response at 1,000 rows by default, so a plain
// select over a year+ of interactions silently comes back short --
// every impact number here pages through the whole period instead.
const PAGE_SIZE = 1000;

export async function selectAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** The start of this month / quarter in Cleveland (midnight Eastern on
 * the 1st), not the server's UTC -- otherwise the last evening of the
 * previous month would be counted in this one. */
export function periodStart(period: ImpactPeriod): string | null {
  const { year, month } = orgMonthStart();
  if (period === "month") {
    return orgDayStartIso(`${year}-${pad2(month)}-01`);
  }
  if (period === "quarter") {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return orgDayStartIso(`${year}-${pad2(quarterStartMonth)}-01`);
  }
  return null;
}

export async function getImpactBreakdown(period: ImpactPeriod = "month", facilityId?: string): Promise<{
  buckets: ImpactBucket[];
  total: number;
}> {
  const supabase = await createClient();
  const start = periodStart(period);

  const data = await selectAllPages<{ interaction_type: string }>((from, to) => {
    let query = supabase.from("interactions").select("interaction_type").order("id").range(from, to);
    if (start) query = query.gte("occurred_at", start);
    if (facilityId) query = query.eq("facility_id", facilityId);
    return query;
  });

  const counts = new Map<string, number>();
  for (const row of data) {
    const type = row.interaction_type as string;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const buckets = BUCKET_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    color: def.color,
    count: def.types.reduce((sum, t) => sum + (counts.get(t) ?? 0), 0),
  }));

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  return { buckets, total };
}

export type PersonImpactRow = { id: string; name: string; count: number };

/** How many interactions each staff member logged in the period — lets
 * the director show funders (and staff themselves) impact beyond just
 * their own work, not just a single org-wide total. */
export async function getStaffActivity(period: ImpactPeriod = "month", facilityId?: string): Promise<PersonImpactRow[]> {
  const supabase = await createClient();
  const start = periodStart(period);

  const data = await selectAllPages((from, to) => {
    let query = supabase.from("interactions").select("staff_member_id, profiles(full_name)").order("id").range(from, to);
    if (start) query = query.gte("occurred_at", start);
    if (facilityId) query = query.eq("facility_id", facilityId);
    return query;
  });

  const counts = new Map<string, PersonImpactRow>();
  for (const row of data) {
    const r = row as unknown as { staff_member_id: string; profiles: { full_name: string } | null };
    const existing = counts.get(r.staff_member_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.staff_member_id, {
        id: r.staff_member_id,
        name: r.profiles?.full_name ?? "Unknown",
        count: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export type MonthlyCount = { key: string; label: string; count: number };

/** Total interactions logged per month, most recent `months` months
 * (oldest first) -- a simple trend line for showing growth over time,
 * separate from the type/staff/volunteer breakdowns above. */
export async function getInteractionTrend(months = 6): Promise<MonthlyCount[]> {
  const supabase = await createClient();
  const first = orgMonthStart(months - 1);
  const start = orgDayStartIso(`${first.year}-${pad2(first.month)}-01`)!;

  const data = await selectAllPages<{ occurred_at: string }>((from, to) =>
    supabase.from("interactions").select("occurred_at").gte("occurred_at", start).order("id").range(from, to)
  );

  // Months are Cleveland months, so a visit on the evening of the 31st
  // lands in its own month rather than the next one.
  const buckets: MonthlyCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const { year, month } = orgMonthStart(i);
    buckets.push({
      key: `${year}-${pad2(month)}`,
      label: new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      count: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const row of data) {
    const key = orgMonthKey(row.occurred_at);
    const idx = indexByKey.get(key);
    if (idx !== undefined) buckets[idx].count += 1;
  }

  return buckets;
}

/** How many logged interactions each volunteer took part in during the
 * period — the volunteer-side equivalent of getStaffActivity, for
 * showing volunteer impact separately from staff impact. */
export async function getVolunteerImpact(period: ImpactPeriod = "month", facilityId?: string): Promise<PersonImpactRow[]> {
  const supabase = await createClient();
  const start = periodStart(period);

  const data = await selectAllPages((from, to) =>
    supabase
      .from("interaction_volunteers")
      .select("interaction_id, contact_id, contacts(name), interactions(occurred_at, facility_id)")
      .order("interaction_id")
      .order("contact_id")
      .range(from, to)
  );

  const counts = new Map<string, PersonImpactRow>();
  for (const row of data) {
    const r = row as unknown as {
      contact_id: string;
      contacts: { name: string } | null;
      interactions: { occurred_at: string; facility_id: string | null } | null;
    };
    if (start && (!r.interactions || Date.parse(r.interactions.occurred_at) < Date.parse(start))) continue;
    if (facilityId && r.interactions?.facility_id !== facilityId) continue;
    const existing = counts.get(r.contact_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.contact_id, {
        id: r.contact_id,
        name: r.contacts?.name ?? "Unknown volunteer",
        count: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export type ServicesDelivered = {
  food: {
    deliveries: number;
    items: number;
    peopleReached: number;
    byOccasion: { shabbos: number; yomTov: number; other: number };
  };
  volunteers: { volunteers: number; visits: number; hours: number; residentsVisited: number };
  schoolShul: { programs: number; school: number; shul: number; participants: number; peopleReached: number };
  /** Different residents who had a one-on-one visit or call (staff or
   * volunteer) in the period -- each person counted once -- and how many
   * such visits and calls there were. */
  oneOnOne: { residents: number; contacts: number };
  /** Every "Residents reached" count added up -- programs, deliveries and
   * group visits. Approximate attendance: the same person can be counted
   * more than once, and one-on-one visits (left blank) aren't in it. */
  peopleReached: {
    total: number;
    programs: number;
    food: number;
    schoolShul: number;
    volunteerGroups: number;
    residentGroups: number;
    other: number;
  };
  medicalReferrals: number;
  rides: number;
  careNavigation: { families: number; hours: number };
  unmetNeed: { total: number; byReason: { reason: string; count: number }[] };
  staffHours: number;
  funderStories: number;
};

type ServiceRow = {
  id: string;
  interaction_type: string;
  resident_id: string | null;
  occasion: string | null;
  program_partner: string | null;
  quantity: number | null;
  people_reached: number | null;
  participants: number | null;
  minutes_spent: number | null;
  unmet_need: boolean;
  unmet_need_reason: string | null;
  funder_story: boolean;
};

/** Contact with one named resident: visits and calls, by staff or volunteers. */
const ONE_ON_ONE_TYPES = new Set(["resident_visit", "resident_phone_call", "volunteer_visit"]);

const toHours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** The funder-facing "Services delivered" numbers: what the department
 * did beyond its own visits and facility programs. Counts only -- no
 * names -- so it's safe for the export (see PRIVACY_AND_SECURITY.md).
 *
 * Volunteer hours are each visit's time spent times the number of
 * volunteers tagged on it (two volunteers for an hour = two volunteer
 * hours); staff hours are time spent on everything else. */
export async function getServicesDelivered(period: ImpactPeriod = "month", facilityId?: string): Promise<ServicesDelivered> {
  const supabase = await createClient();
  const start = periodStart(period);

  const [rows, volunteerLinks] = await Promise.all([
    selectAllPages<ServiceRow>((from, to) => {
      let query = supabase
        .from("interactions")
        .select(
          "id, interaction_type, resident_id, occasion, program_partner, quantity, people_reached, participants, minutes_spent, unmet_need, unmet_need_reason, funder_story"
        )
        .order("id")
        .range(from, to);
      if (start) query = query.gte("occurred_at", start);
      // Volunteer links are only ever looked up by these rows' ids, so
      // filtering the rows is enough to scope everything to one facility.
      if (facilityId) query = query.eq("facility_id", facilityId);
      return query;
    }),
    selectAllPages<{ interaction_id: string; contact_id: string; interactions: { occurred_at: string } | null }>(
      (from, to) =>
        supabase
          .from("interaction_volunteers")
          .select("interaction_id, contact_id, interactions(occurred_at)")
          .order("interaction_id")
          .order("contact_id")
          .range(from, to) as unknown as PromiseLike<{
          data: { interaction_id: string; contact_id: string; interactions: { occurred_at: string } | null }[] | null;
          error: { message: string } | null;
        }>
    ),
  ]);

  const volunteersByInteraction = new Map<string, Set<string>>();
  for (const link of volunteerLinks) {
    if (start && (!link.interactions || Date.parse(link.interactions.occurred_at) < Date.parse(start))) continue;
    const set = volunteersByInteraction.get(link.interaction_id) ?? new Set<string>();
    set.add(link.contact_id);
    volunteersByInteraction.set(link.interaction_id, set);
  }

  const result: ServicesDelivered = {
    food: { deliveries: 0, items: 0, peopleReached: 0, byOccasion: { shabbos: 0, yomTov: 0, other: 0 } },
    volunteers: { volunteers: 0, visits: 0, hours: 0, residentsVisited: 0 },
    schoolShul: { programs: 0, school: 0, shul: 0, participants: 0, peopleReached: 0 },
    oneOnOne: { residents: 0, contacts: 0 },
    peopleReached: { total: 0, programs: 0, food: 0, schoolShul: 0, volunteerGroups: 0, residentGroups: 0, other: 0 },
    medicalReferrals: 0,
    rides: 0,
    careNavigation: { families: 0, hours: 0 },
    unmetNeed: { total: 0, byReason: [] },
    staffHours: 0,
    funderStories: 0,
  };

  const volunteerIds = new Set<string>();
  const residentsVisited = new Set<string>();
  const oneOnOneResidents = new Set<string>();
  const unmetByReason = new Map<string, number>();
  let volunteerMinutes = 0;
  let staffMinutes = 0;
  let careMinutes = 0;

  for (const row of rows) {
    const minutes = row.minutes_spent ?? 0;
    switch (row.interaction_type) {
      case "food_delivery":
        result.food.deliveries += 1;
        result.food.items += row.quantity ?? 0;
        result.food.peopleReached += row.people_reached ?? 0;
        if (row.occasion === "shabbos") result.food.byOccasion.shabbos += 1;
        else if (row.occasion === "yom_tov") result.food.byOccasion.yomTov += 1;
        else result.food.byOccasion.other += 1;
        break;
      case "volunteer_visit": {
        result.volunteers.visits += 1;
        const tagged = volunteersByInteraction.get(row.id);
        tagged?.forEach((id) => volunteerIds.add(id));
        if (row.resident_id) residentsVisited.add(row.resident_id);
        volunteerMinutes += minutes * Math.max(tagged?.size ?? 0, 1);
        break;
      }
      case "school_engagement":
        result.schoolShul.programs += 1;
        if (row.program_partner === "shul") result.schoolShul.shul += 1;
        else result.schoolShul.school += 1;
        result.schoolShul.participants += row.participants ?? 0;
        result.schoolShul.peopleReached += row.people_reached ?? 0;
        break;
      case "medical_referral":
        result.medicalReferrals += 1;
        break;
      case "ride_arranged":
        result.rides += 1;
        break;
      case "care_navigation":
        result.careNavigation.families += 1;
        careMinutes += minutes;
        break;
    }
    if (row.resident_id && ONE_ON_ONE_TYPES.has(row.interaction_type)) {
      result.oneOnOne.contacts += 1;
      oneOnOneResidents.add(row.resident_id);
    }
    if (row.people_reached) {
      const reached = result.peopleReached;
      reached.total += row.people_reached;
      if (row.interaction_type === "program") reached.programs += row.people_reached;
      else if (row.interaction_type === "food_delivery") reached.food += row.people_reached;
      else if (row.interaction_type === "school_engagement") reached.schoolShul += row.people_reached;
      else if (row.interaction_type === "volunteer_visit") reached.volunteerGroups += row.people_reached;
      else if (row.interaction_type === "resident_visit") reached.residentGroups += row.people_reached;
      else reached.other += row.people_reached;
    }
    if (row.interaction_type !== "volunteer_visit") staffMinutes += minutes;
    if (row.unmet_need) {
      result.unmetNeed.total += 1;
      const reason = row.unmet_need_reason ?? "unspecified";
      unmetByReason.set(reason, (unmetByReason.get(reason) ?? 0) + 1);
    }
    if (row.funder_story) result.funderStories += 1;
  }

  result.oneOnOne.residents = oneOnOneResidents.size;
  result.volunteers.volunteers = volunteerIds.size;
  result.volunteers.residentsVisited = residentsVisited.size;
  result.volunteers.hours = toHours(volunteerMinutes);
  result.careNavigation.hours = toHours(careMinutes);
  result.staffHours = toHours(staffMinutes);
  result.unmetNeed.byReason = Array.from(unmetByReason, ([reason, count]) => ({ reason, count })).sort(
    (a, b) => b.count - a.count
  );

  return result;
}
