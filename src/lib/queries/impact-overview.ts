import { createClient } from "@/lib/supabase/server";
import { orgDayStartIso, orgMonthKey } from "@/lib/format-date";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { HOLIDAYS, FAMILY_NEEDS } from "@/lib/domain/interaction";
import { pad2, selectAllPages } from "@/lib/queries/impact";
import { inPeriod, monthsOf, periodBounds, previousPeriod, type ReportPeriod } from "@/lib/report-period";
import {
  facilityPresence,
  fetchEngagedLinks,
  fetchPartnerContacts,
  fetchTeamLinks,
  groupCountsFor,
  isCounted,
  partnerConversationsFor,
  partnerPeopleOn,
  staffInteractionFor,
  staffPeopleOn,
  staffVisits,
  STAFF_SUPPORT_TYPES,
  type EngagedLinks,
  type PartnerContacts,
  type TeamLinks,
} from "@/lib/queries/report-rules";

// What each section of the Impact page counts. Kept here so every number
// on the page uses the same definitions.
const ONE_ON_ONE = new Set(["resident_visit", "resident_phone_call", "volunteer_visit"]);
const STAFF_VISITS = new Set(["resident_visit", "resident_phone_call"]);
const FAMILY = new Set(["family_communication", "care_navigation"]);
const STAFF_SUPPORT = STAFF_SUPPORT_TYPES;
const PROGRAMS = new Set(["program", "school_engagement"]);

/** Where each headline number's entries live: the Interactions list,
 * filtered to the same kinds of entry the number counts. */
export const HEADLINE_TYPES = {
  residents: [...ONE_ON_ONE],
  families: [...FAMILY],
  staff: [...STAFF_SUPPORT],
  reached: [...PROGRAMS, "food_delivery"],
} as const;

/** "/interactions?types=a,b&from=2026-10-01&to=2026-10-31" -- the list
 * of entries behind a number or a bar. */
function interactionsHref(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return `/interactions?${q.toString()}`;
}


type Row = {
  id: string;
  interaction_type: string;
  occurred_at: string;
  staff_member_id: string | null;
  participants: number | null;
  student_count: number | null;
  volunteer_count: number | null;
  part_of_id: string | null;
  counted_in_id: string | null;
  resident_id: string | null;
  contact_id: string | null;
  facility_id: string | null;
  people_reached: number | null;
  holiday: string | null;
  family_need: string | null;
  in_person: boolean | null;
  method: string | null;
  voided_at: string | null;
};

export type Headline = {
  residents: number;
  residentContacts: number;
  families: number;
  familyConversations: number;
  /** Staff interactions: each facility staff person spoken with, once per
   * entry (Oct 27, 2026; no separate meetings number). */
  staffTouchpoints: number;
  /** Different staff people met. */
  staffPeople: number;
  staffFacilities: number;
  /** Partner conversations (school, shul, hospice, agency...), each person
   * once per entry, and the different partners spoken with. */
  partnerConversations: number;
  partnerPeople: number;
  reached: number;
  programs: number;
  deliveries: number;
  /** Each facility once per day our staff were there in person. */
  visitDays: number;
  /** Each staff member once per facility per day they were there. */
  staffVisits: number;
  /** Each facility once per day only volunteers were there. */
  volunteerOnlyDays: number;
  /** Each facility once per day anyone from Bikur Cholim was there. */
  presenceDays: number;
  /** Different facilities with a presence day. */
  facilitiesVisited: number;
  /** Different facilities with any entry, calls included. */
  facilitiesEngaged: number;
  /** Volunteer visits, counted on their own (they make no staff visit-day). */
  volunteerVisits: number;
  /** Program head counts, each project counted once: students and
   * volunteers, and older entries' single number (not split). */
  groupStudents: number;
  groupVolunteers: number;
  groupNotSplit: number;
  groupProjects: number;
};

/** The headline numbers for a set of entries. Pass only counted entries
 * for the corrected numbers, or every entry for "as first recorded". */
function headlineFor(rows: Row[], engaged: EngagedLinks, partners: PartnerContacts, team: TeamLinks): Headline {
  const residents = new Set<string>();
  const families = new Set<string>();
  const staffFacilities = new Set<string>();
  const staffPeople = new Set<string>();
  const partnerPeople = new Set<string>();
  const presence = facilityPresence(rows);
  const h: Headline = {
    residents: 0, residentContacts: 0, families: 0, familyConversations: 0,
    staffTouchpoints: 0, staffPeople: 0, staffFacilities: 0, partnerConversations: 0, partnerPeople: 0,
    reached: 0, programs: 0, deliveries: 0,
    visitDays: presence.staffVisitDays, staffVisits: staffVisits(rows, team), volunteerOnlyDays: presence.volunteerOnlyDays,
    presenceDays: presence.presenceDays, facilitiesVisited: presence.facilitiesVisited,
    facilitiesEngaged: presence.facilitiesEngaged,
    volunteerVisits: 0, groupStudents: 0, groupVolunteers: 0, groupNotSplit: 0, groupProjects: 0,
  };
  for (const r of rows) {
    if (ONE_ON_ONE.has(r.interaction_type) && r.resident_id) {
      h.residentContacts += 1;
      residents.add(r.resident_id);
    }
    if (FAMILY.has(r.interaction_type)) {
      h.familyConversations += 1;
      // A family is the family member spoken with, else the resident whose family it was.
      const key = r.contact_id ?? r.resident_id;
      if (key) families.add(key);
    }
    // Staff interactions, one per person spoken with, and who was met;
    // partner conversations the same, on their own line.
    const staffCount = staffInteractionFor(r, engaged, partners);
    if (staffCount > 0) {
      h.staffTouchpoints += staffCount;
      if (r.facility_id) staffFacilities.add(r.facility_id);
    }
    staffPeopleOn(r, engaged, partners).forEach((p) => staffPeople.add(p));
    h.partnerConversations += partnerConversationsFor(r, engaged, partners);
    partnerPeopleOn(r, engaged, partners).forEach((p) => partnerPeople.add(p));
    if (r.interaction_type === "volunteer_visit") h.volunteerVisits += 1;
    const group = groupCountsFor(r);
    if (group.students + group.volunteers + group.notSplit > 0) {
      h.groupStudents += group.students;
      h.groupVolunteers += group.volunteers;
      h.groupNotSplit += group.notSplit;
      h.groupProjects += 1;
    }
    if (PROGRAMS.has(r.interaction_type)) h.programs += 1;
    if (r.interaction_type === "food_delivery") h.deliveries += 1;
    h.reached += r.people_reached ?? 0;
  }
  h.residents = residents.size;
  h.families = families.size;
  h.staffFacilities = staffFacilities.size;
  h.staffPeople = staffPeople.size;
  h.partnerPeople = partnerPeople.size;
  return h;
}

export type MonthBar = { label: string; values: number[]; href?: string };
export type LabeledValue = { label: string; value: number; href?: string; color?: string };

export type ImpactOverview = {
  /** Corrected: entries reviewed as double entries are counted once. */
  headline: Headline;
  /** The same numbers as first recorded (copies included) -- only when a
   * reviewed double entry falls in the period, so the two can be shown
   * side by side. */
  asFirstRecorded: Headline | null;
  /** Reviewed double entries in the period, and the list behind them. */
  corrections: { entries: number; href: string } | null;
  /** The entries behind each headline number, for the period. */
  headlineLinks: Record<keyof typeof HEADLINE_TYPES, string>;
  previous: Headline | null;
  visitsByMonth: MonthBar[]; // [staff, volunteer]
  familyByMonth: MonthBar[];
  staffByMonth: MonthBar[];
  recency: LabeledValue[];
  activeResidents: number;
  notVisited30: number;
  withFamily: number;
  careNavigation: number;
  holidays: LabeledValue[];
  familyNeeds: LabeledValue[];
  stages: LabeledValue[];
  facilitiesTotal: number;
  noJewishResidentsKnown: number;
  topFacilities: LabeledValue[];
};

export async function getImpactOverview(period: ReportPeriod): Promise<ImpactOverview> {
  const supabase = await createClient();
  const bounds = periodBounds(period);
  const prevPeriod = previousPeriod(period);
  const prev = prevPeriod ? periodBounds(prevPeriod) : null;
  // Monthly bars: the period's own months (the last 6 for all time).
  const months = monthsOf(period);
  const monthsStart = periodBounds(months[0]).start!;
  const monthsEnd = periodBounds(months[months.length - 1]).end!;
  // One fetch covering the period, the one before it, and the bars.
  const fetchFrom = period.from ? [monthsStart, prev?.start ?? monthsStart, bounds.start!].sort()[0] : null;
  const fetchTo = period.to ? [monthsEnd, bounds.end!].sort()[1] : null;

  const [allRows, residents, links, facilities, engaged, partners, team] = await Promise.all([
    selectAllPages<Row>((from, to) => {
      let q = supabase
        .from("interactions")
        .select(
          "id, interaction_type, occurred_at, staff_member_id, resident_id, contact_id, facility_id, people_reached, holiday, family_need, participants, student_count, volunteer_count, part_of_id, counted_in_id, in_person, method, voided_at"
        )
        .order("id")
        .range(from, to);
      if (fetchFrom) q = q.gte("occurred_at", fetchFrom);
      if (fetchTo) q = q.lt("occurred_at", fetchTo);
      return q;
    }),
    selectAllPages<{ id: string; status: string; last_visit_at: string | null }>((from, to) =>
      supabase.from("resident_summary").select("id, status, last_visit_at").order("id").range(from, to)
    ),
    selectAllPages<{ resident_id: string }>((from, to) =>
      supabase.from("resident_contacts").select("resident_id").eq("active", true).order("id").range(from, to)
    ),
    selectAllPages<{ id: string; name: string; engagement_status: string }>((from, to) =>
      supabase.from("facilities").select("id, name, engagement_status").eq("active", true).order("id").range(from, to)
    ),
    fetchEngagedLinks(supabase, fetchFrom),
    fetchPartnerContacts(supabase),
    fetchTeamLinks(supabase),
  ]);

  // Every number below counts each activity once: an entry an admin
  // reviewed as a copy of another ("Same visit"), or one that was voided,
  // is left out. The as-first-recorded numbers keep both, for comparison
  // with reports already sent.
  const rows = allRows.filter(isCounted);
  const allInPeriod = allRows.filter((r) => inPeriod(r.occurred_at, bounds));

  const counted = rows.filter((r) => inPeriod(r.occurred_at, bounds));
  const inPrev = prev ? rows.filter((r) => inPeriod(r.occurred_at, prev)) : null;

  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  const monthHref = (m: ReportPeriod, types: readonly string[]) =>
    interactionsHref({ types: types.join(","), from: m.from, to: m.to });
  const monthLabel = (m: ReportPeriod) =>
    new Date(Date.UTC(Number(m.key.slice(0, 4)), Number(m.key.slice(5, 7)) - 1, 15)).toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
  const visitsByMonth = months.map((m) => ({ label: monthLabel(m), values: [0, 0], href: monthHref(m, HEADLINE_TYPES.residents) }));
  const familyByMonth = months.map((m) => ({ label: monthLabel(m), values: [0], href: monthHref(m, HEADLINE_TYPES.families) }));
  const staffByMonth = months.map((m) => ({ label: monthLabel(m), values: [0], href: monthHref(m, HEADLINE_TYPES.staff) }));
  for (const r of rows) {
    const i = monthIndex.get(orgMonthKey(r.occurred_at));
    if (i === undefined) continue;
    if (STAFF_VISITS.has(r.interaction_type)) visitsByMonth[i].values[0] += 1;
    if (r.interaction_type === "volunteer_visit") visitsByMonth[i].values[1] += 1;
    if (FAMILY.has(r.interaction_type)) familyByMonth[i].values[0] += 1;
    staffByMonth[i].values[0] += staffInteractionFor(r, engaged, partners);
  }

  // Time since last visit -- active residents, today (not the period).
  const active = residents.filter((r) => (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status));
  const day = 24 * 60 * 60 * 1000;
  const recencyCounts = [0, 0, 0, 0];
  for (const r of active) {
    if (!r.last_visit_at) recencyCounts[3] += 1;
    else {
      const age = (Date.now() - new Date(r.last_visit_at).getTime()) / day;
      recencyCounts[age < 30 ? 0 : age < 90 ? 1 : 2] += 1;
    }
  }
  const recency = ["Under 30 days", "30–90 days", "90+ days", "Never visited"].map((label, i) => ({
    label,
    value: recencyCounts[i],
    // Anyone 30+ days (or never) is exactly the Needs attention list.
    href: i === 0 ? "/residents" : "/needs-attention",
  }));

  const activeIds = new Set(active.map((r) => r.id));
  const withFamily = new Set(links.map((l) => l.resident_id).filter((id) => activeIds.has(id))).size;

  // Holidays: people reached per holiday in the period (a one-on-one visit counts as 1).
  const holidayCounts = new Map<string, number>();
  for (const r of counted) {
    if (!r.holiday) continue;
    const reached = r.people_reached ?? (r.resident_id ? 1 : 0);
    holidayCounts.set(r.holiday, (holidayCounts.get(r.holiday) ?? 0) + reached);
  }
  const { from, to } = period;
  const holidays = HOLIDAYS.filter((h) => holidayCounts.has(h.value)).map((h) => ({
    label: h.label,
    value: holidayCounts.get(h.value)!,
    href: interactionsHref({ holiday: h.value, from, to }),
  }));

  // What families needed, in the period (only entries where it was picked).
  const needCounts = new Map<string, number>();
  for (const r of counted) {
    if (r.family_need) needCounts.set(r.family_need, (needCounts.get(r.family_need) ?? 0) + 1);
  }
  const familyNeeds = FAMILY_NEEDS.filter((f) => needCounts.has(f.value)).map((f) => ({
    label: f.label,
    value: needCounts.get(f.value)!,
    href: interactionsHref({ need: f.value, from, to }),
  }));

  // Facility relationship stage (active facilities).
  const STAGE_OF: Record<string, number> = {
    active_facility: 0, recurring_visits: 0, recurring_programming: 0,
    staff_relationship_developing: 1, follow_up_needed: 1,
    initial_contact: 2,
    not_contacted: 3,
  };
  const stageCounts = [0, 0, 0, 0];
  let noJewishResidentsKnown = 0;
  for (const f of facilities) {
    const s = STAGE_OF[f.engagement_status];
    if (s === undefined) noJewishResidentsKnown += 1;
    else stageCounts[s] += 1;
  }
  const STAGE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
  const stages = ["Active partner", "Relationship developing", "First contact made", "Not yet contacted"].map((label, i) => ({
    label,
    value: stageCounts[i],
    color: STAGE_COLORS[i],
  }));

  // Most-supported facility teams in the period.
  const nameOf = new Map(facilities.map((f) => [f.id, f.name]));
  const perFacility = new Map<string, number>();
  for (const r of counted) {
    const staffCount = staffInteractionFor(r, engaged, partners);
    if (staffCount > 0 && r.facility_id) {
      perFacility.set(r.facility_id, (perFacility.get(r.facility_id) ?? 0) + staffCount);
    }
  }
  const topFacilities = [...perFacility.entries()]
    .filter(([id]) => nameOf.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, value]) => ({ label: nameOf.get(id)!, value, href: `/facilities/${id}` }));

  const reviewedCopies = allInPeriod.filter((r) => !isCounted(r)).length;

  return {
    headline: headlineFor(counted, engaged, partners, team),
    asFirstRecorded: reviewedCopies > 0 ? headlineFor(allInPeriod, engaged, partners, team) : null,
    corrections:
      reviewedCopies > 0 ? { entries: reviewedCopies, href: interactionsHref({ corrected: "1", from, to }) } : null,
    headlineLinks: {
      residents: interactionsHref({ types: HEADLINE_TYPES.residents.join(","), from, to }),
      families: interactionsHref({ types: HEADLINE_TYPES.families.join(","), from, to }),
      staff: interactionsHref({ types: HEADLINE_TYPES.staff.join(","), from, to }),
      reached: interactionsHref({ types: HEADLINE_TYPES.reached.join(","), from, to }),
    },
    previous: inPrev ? headlineFor(inPrev, engaged, partners, team) : null,
    visitsByMonth,
    familyByMonth,
    staffByMonth,
    recency,
    activeResidents: active.length,
    notVisited30: recencyCounts[1] + recencyCounts[2] + recencyCounts[3],
    withFamily,
    careNavigation: counted.filter((r) => r.interaction_type === "care_navigation").length,
    holidays,
    familyNeeds,
    stages,
    facilitiesTotal: facilities.length,
    noJewishResidentsKnown,
    topFacilities,
  };
}

/** "2026-Q4" and its Cleveland start/end, for the quarter a moment falls in. */
export function quarterOf(value: string): { key: string; from: string; to: string } {
  const [y, m] = orgMonthKey(value).split("-").map(Number);
  const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
  const next = firstMonth + 3 > 12 ? { y: y + 1, m: 1 } : { y, m: firstMonth + 3 };
  return {
    key: `${y}-Q${Math.floor((m - 1) / 3) + 1}`,
    from: orgDayStartIso(`${y}-${pad2(firstMonth)}-01`)!,
    to: orgDayStartIso(`${next.y}-${pad2(next.m)}-01`)!,
  };
}

/** A quarter's headline numbers as first recorded -- every entry,
 * including any later reviewed as a double entry -- for the one-time
 * snapshot taken before that quarter's first correction. */
export async function headlineAsFirstRecorded(fromIso: string, toIso: string): Promise<Headline> {
  const supabase = await createClient();
  const [rows, engaged, partners, team] = await Promise.all([
    selectAllPages<Row>((from, to) =>
      supabase
        .from("interactions")
        .select(
          "id, interaction_type, occurred_at, staff_member_id, resident_id, contact_id, facility_id, people_reached, holiday, family_need, participants, student_count, volunteer_count, part_of_id, counted_in_id, in_person, method, voided_at"
        )
        .gte("occurred_at", fromIso)
        .lt("occurred_at", toIso)
        .order("id")
        .range(from, to)
    ),
    fetchEngagedLinks(supabase, fromIso),
    fetchPartnerContacts(supabase),
    fetchTeamLinks(supabase),
  ]);
  return headlineFor(rows, engaged, partners, team);
}
