import { createClient } from "@/lib/supabase/server";
import { orgDayStartIso, orgMonthStart, orgMonthKey } from "@/lib/format-date";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { HOLIDAYS, FAMILY_NEEDS } from "@/lib/domain/interaction";
import { pad2, periodStart, selectAllPages, type ImpactPeriod } from "@/lib/queries/impact";

// What each section of the Impact page counts. Kept here so every number
// on the page uses the same definitions.
const ONE_ON_ONE = new Set(["resident_visit", "resident_phone_call", "volunteer_visit"]);
const STAFF_VISITS = new Set(["resident_visit", "resident_phone_call"]);
const FAMILY = new Set(["family_communication", "care_navigation"]);
const STAFF_SUPPORT = new Set(["facility_staff_communication", "facility_discovery_visit"]);
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

/** First Cleveland calendar day of the period ("2026-10-01"), or null for all time. */
function periodFromDate(period: ImpactPeriod): string | null {
  if (period === "all") return null;
  const { year, month } = orgMonthStart();
  const first = period === "month" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${pad2(first)}-01`;
}

type Row = {
  interaction_type: string;
  occurred_at: string;
  resident_id: string | null;
  contact_id: string | null;
  facility_id: string | null;
  people_reached: number | null;
  holiday: string | null;
  family_need: string | null;
};

export type Headline = {
  residents: number;
  residentContacts: number;
  families: number;
  familyConversations: number;
  staffTouchpoints: number;
  staffFacilities: number;
  reached: number;
  programs: number;
  deliveries: number;
};

function headlineFor(rows: Row[]): Headline {
  const residents = new Set<string>();
  const families = new Set<string>();
  const staffFacilities = new Set<string>();
  const h: Headline = {
    residents: 0, residentContacts: 0, families: 0, familyConversations: 0,
    staffTouchpoints: 0, staffFacilities: 0, reached: 0, programs: 0, deliveries: 0,
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
    if (STAFF_SUPPORT.has(r.interaction_type)) {
      h.staffTouchpoints += 1;
      if (r.facility_id) staffFacilities.add(r.facility_id);
    }
    if (PROGRAMS.has(r.interaction_type)) h.programs += 1;
    if (r.interaction_type === "food_delivery") h.deliveries += 1;
    h.reached += r.people_reached ?? 0;
  }
  h.residents = residents.size;
  h.families = families.size;
  h.staffFacilities = staffFacilities.size;
  return h;
}

/** The month or quarter before the current one, as [start, end). */
function previousRange(period: ImpactPeriod): { start: string; end: string } | null {
  if (period === "all") return null;
  const { year, month } = orgMonthStart();
  const len = period === "month" ? 1 : 3;
  const currentFirst = period === "month" ? month : Math.floor((month - 1) / 3) * 3 + 1;
  const prevIndex = year * 12 + (currentFirst - 1) - len;
  const py = Math.floor(prevIndex / 12);
  const pm = (prevIndex % 12) + 1;
  return {
    start: orgDayStartIso(`${py}-${pad2(pm)}-01`)!,
    end: orgDayStartIso(`${year}-${pad2(currentFirst)}-01`)!,
  };
}

export type MonthBar = { label: string; values: number[]; href?: string };
export type LabeledValue = { label: string; value: number; href?: string; color?: string };

export type ImpactOverview = {
  headline: Headline;
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

export async function getImpactOverview(period: ImpactPeriod): Promise<ImpactOverview> {
  const supabase = await createClient();
  const start = periodStart(period);
  const prev = previousRange(period);
  const sixMonthsFirst = orgMonthStart(5);
  const sixMonthsStart = orgDayStartIso(`${sixMonthsFirst.year}-${pad2(sixMonthsFirst.month)}-01`)!;
  const fetchFrom = period === "all" ? null : [sixMonthsStart, prev?.start ?? sixMonthsStart].sort()[0];

  const [rows, residents, links, facilities] = await Promise.all([
    selectAllPages<Row>((from, to) => {
      let q = supabase
        .from("interactions")
        .select("interaction_type, occurred_at, resident_id, contact_id, facility_id, people_reached, holiday, family_need")
        .order("id")
        .range(from, to);
      if (fetchFrom) q = q.gte("occurred_at", fetchFrom);
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
  ]);

  const inPeriod = start ? rows.filter((r) => r.occurred_at >= start) : rows;
  const inPrev = prev ? rows.filter((r) => r.occurred_at >= prev.start && r.occurred_at < prev.end) : null;

  // Last 6 Cleveland months, oldest first.
  const months: { key: string; label: string; from: string; to: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const { year, month } = orgMonthStart(i);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    months.push({
      key: `${year}-${pad2(month)}`,
      from: `${year}-${pad2(month)}-01`,
      to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
      label: new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  const monthHref = (m: { from: string; to: string }, types: readonly string[]) =>
    interactionsHref({ types: types.join(","), from: m.from, to: m.to });
  const visitsByMonth = months.map((m) => ({ label: m.label, values: [0, 0], href: monthHref(m, HEADLINE_TYPES.residents) }));
  const familyByMonth = months.map((m) => ({ label: m.label, values: [0], href: monthHref(m, HEADLINE_TYPES.families) }));
  const staffByMonth = months.map((m) => ({ label: m.label, values: [0], href: monthHref(m, HEADLINE_TYPES.staff) }));
  for (const r of rows) {
    const i = monthIndex.get(orgMonthKey(r.occurred_at));
    if (i === undefined) continue;
    if (STAFF_VISITS.has(r.interaction_type)) visitsByMonth[i].values[0] += 1;
    if (r.interaction_type === "volunteer_visit") visitsByMonth[i].values[1] += 1;
    if (FAMILY.has(r.interaction_type)) familyByMonth[i].values[0] += 1;
    if (STAFF_SUPPORT.has(r.interaction_type)) staffByMonth[i].values[0] += 1;
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
  for (const r of inPeriod) {
    if (!r.holiday) continue;
    const reached = r.people_reached ?? (r.resident_id ? 1 : 0);
    holidayCounts.set(r.holiday, (holidayCounts.get(r.holiday) ?? 0) + reached);
  }
  const from = periodFromDate(period);
  const holidays = HOLIDAYS.filter((h) => holidayCounts.has(h.value)).map((h) => ({
    label: h.label,
    value: holidayCounts.get(h.value)!,
    href: interactionsHref({ holiday: h.value, from }),
  }));

  // What families needed, in the period (only entries where it was picked).
  const needCounts = new Map<string, number>();
  for (const r of inPeriod) {
    if (r.family_need) needCounts.set(r.family_need, (needCounts.get(r.family_need) ?? 0) + 1);
  }
  const familyNeeds = FAMILY_NEEDS.filter((f) => needCounts.has(f.value)).map((f) => ({
    label: f.label,
    value: needCounts.get(f.value)!,
    href: interactionsHref({ need: f.value, from }),
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
  for (const r of inPeriod) {
    if (STAFF_SUPPORT.has(r.interaction_type) && r.facility_id) {
      perFacility.set(r.facility_id, (perFacility.get(r.facility_id) ?? 0) + 1);
    }
  }
  const topFacilities = [...perFacility.entries()]
    .filter(([id]) => nameOf.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, value]) => ({ label: nameOf.get(id)!, value, href: `/facilities/${id}` }));

  return {
    headline: headlineFor(inPeriod),
    headlineLinks: {
      residents: interactionsHref({ types: HEADLINE_TYPES.residents.join(","), from }),
      families: interactionsHref({ types: HEADLINE_TYPES.families.join(","), from }),
      staff: interactionsHref({ types: HEADLINE_TYPES.staff.join(","), from }),
      reached: interactionsHref({ types: HEADLINE_TYPES.reached.join(","), from }),
    },
    previous: inPrev ? headlineFor(inPrev) : null,
    visitsByMonth,
    familyByMonth,
    staffByMonth,
    recency,
    activeResidents: active.length,
    notVisited30: recencyCounts[1] + recencyCounts[2] + recencyCounts[3],
    withFamily,
    careNavigation: inPeriod.filter((r) => r.interaction_type === "care_navigation").length,
    holidays,
    familyNeeds,
    stages,
    facilitiesTotal: facilities.length,
    noJewishResidentsKnown,
    topFacilities,
  };
}
