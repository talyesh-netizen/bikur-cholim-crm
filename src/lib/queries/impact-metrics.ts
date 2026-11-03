import { createClient } from "@/lib/supabase/server";
import { orgDayStartIso, orgMonthKey } from "@/lib/format-date";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { CONTACT_TYPES, PARTNER_CONTACT_TYPES, labelFor } from "@/lib/domain/contact";
import { FAMILY_NEEDS, HOLIDAYS } from "@/lib/domain/interaction";
import { selectAllPages } from "@/lib/queries/impact";
import { inPeriod, monthsOf, periodBounds, previousPeriod, type ReportPeriod } from "@/lib/report-period";
import {
  coordinatedOnly,
  facilityCoverage,
  fetchEngagedLinks,
  fetchTeamLinks,
  groupCountsFor,
  isCounted,
  isSchoolProgram,
  partnerConversationsFor,
  partnerPeopleOn,
  staffAttendance,
  staffInteractionFor,
  staffPeopleOn,
  volunteerOutingKey,
  volunteerOutingKeys,
  ATTENDANCE_TYPES,
  GROUP_PROJECT_TYPES,
  type CountableRow,
  type CoverageDay,
  type EngagedLinks,
  type FacilityCoverage,
  type PartnerContacts,
  type TeamLinks,
  type VolunteerLinks,
} from "@/lib/queries/report-rules";

/**
 * Every Impact number, worked out once, with the records behind it (final
 * cleanup batch, director and ChatGPT, Nov 3, 2026). The Impact page, the
 * funder export and the "records behind this number" lists all read this,
 * so a number and its list can never disagree. The counting rules
 * themselves are in report-rules.ts.
 *
 * Eight sections, never added together (Q7): resident support, facility
 * coverage, programs, school engagement, community volunteers, food,
 * family, professional relationships -- plus a "today" band that doesn't
 * follow the period.
 */

export type MetricRow = CountableRow & {
  resident_id: string | null;
  people_reached: number | null;
  holiday: string | null;
  family_need: string | null;
  entered_by: string | null;
};

/** What a number counts, said once (shown in lists and the export). */
export type Unit = "people" | "entries" | "facility-days" | "staff-days" | "outings" | "head count" | "facilities" | "organizations";

export type MetricDef = {
  key: string;
  section: SectionKey;
  label: string;
  /** A few words under the number. */
  short: string;
  /** The full definition, behind the "i" and at the top of its list. */
  full: string;
  unit: Unit;
  /** Approximate (a typed-in head count). */
  approx?: boolean;
};

export type SectionKey = "residents" | "coverage" | "programs" | "school" | "volunteers" | "food" | "family" | "professional";

export const SECTIONS: { key: SectionKey; title: string; intro: string }[] = [
  { key: "residents", title: "Resident engagement", intro: "One-on-one visits and calls with residents, plus referrals and rides (shown apart, not counted as engagements)." },
  { key: "coverage", title: "Facility coverage", intro: "Each facility once per day. Staff presence is counted only when it's confirmed." },
  { key: "programs", title: "Programs", intro: "Programs held and residents attending." },
  { key: "school", title: "School engagement", intro: "Programs with schools, the students and school staff who took part, and students on volunteer visits." },
  { key: "volunteers", title: "Community volunteers", intro: "Volunteer outings, the community volunteers on them, and the residents they visited." },
  { key: "food", title: "Food assistance", intro: "Deliveries and the people who received food." },
  { key: "family", title: "Family support", intro: "Conversations with family members, and the families supported." },
  { key: "professional", title: "Professional relationships", intro: "Facility staff and community partners we worked with, and staff appreciation." },
];

export const METRICS: MetricDef[] = [
  // Resident support
  { key: "residents_served", section: "residents", label: "Residents engaged", short: "different residents", unit: "people", full: "Different residents named on a visit, a volunteer visit or a phone call. Each person once." },
  { key: "resident_engagements", section: "residents", label: "Resident engagements", short: "visits & calls, one per resident", unit: "entries", full: "Visits by staff, visits by volunteers and phone calls with a named resident, one per resident (a volunteer outing that saw three residents is three engagements). Referrals, rides, food and programs aren't engagements." },
  { key: "staff_resident_visits", section: "residents", label: "Visits by staff", short: "in-person visits", unit: "entries", full: "Staff visits with a named resident. Each visit once, however many staff went." },
  { key: "phone_calls", section: "residents", label: "Phone calls", short: "with residents", unit: "entries", full: "Phone calls with residents. Calls never count as visits." },
  { key: "volunteer_resident_visits", section: "residents", label: "Visits by volunteers", short: "in-person visits", unit: "entries", full: "Volunteer visits with a named resident, one per resident." },
  { key: "group_visits", section: "residents", label: "Group visits", short: "no resident named", unit: "entries", full: "Visits logged with a \"Residents reached\" number instead of a named resident. Their residents aren't in \"Residents served\"." },
  { key: "group_visit_reached", section: "residents", label: "Residents reached at group visits", short: "approx.", unit: "head count", approx: true, full: "The \"Residents reached\" numbers on group visits added up. The same person can be counted more than once." },
  { key: "referrals", section: "residents", label: "Referrals", short: "service activity", unit: "entries", full: "Medical and other referrals. A service activity, shown apart: not a resident engagement." },
  { key: "rides", section: "residents", label: "Rides arranged", short: "service activity", unit: "entries", full: "Rides arranged through Bikur Cholim (older entries; no longer asked). Not a resident engagement." },
  // Facility coverage
  { key: "activity_days", section: "coverage", label: "Facility activity-days", short: "per facility, per day", unit: "facility-days", full: "Days anything was done at a facility in person (by staff, volunteers or a group), each facility once a day. The three lines below add up to this." },
  { key: "staff_confirmed_days", section: "coverage", label: "Staff presence confirmed", short: "facility-days", unit: "facility-days", full: "Facility-days our staff were confirmed there in person." },
  { key: "not_recorded_days", section: "coverage", label: "Staff attendance not recorded", short: "facility-days", unit: "facility-days", full: "Facility-days with only entries whose staff attendance wasn't recorded (older programs, food deliveries and volunteer visits). The activity happened; whether staff were there isn't known. Never counted as \"no staff there\" until someone confirms it." },
  { key: "no_staff_days", section: "coverage", label: "No staff there", short: "volunteers or groups", unit: "facility-days", full: "Facility-days where it was recorded that no staff were there: volunteers on their own, or a program or delivery saved with \"No staff were there\"." },
  { key: "staff_visits_confirmed", section: "coverage", label: "Staff visits (confirmed)", short: "per person, per facility-day", unit: "staff-days", full: "Each staff member once per facility per day they were confirmed there in person." },
  { key: "staff_visits_not_recorded", section: "coverage", label: "Staff visits not recorded", short: "until confirmed", unit: "staff-days", full: "Staff on an older program, food delivery or volunteer visit whose attendance wasn't recorded, each once per facility per day. Not counted as there, and not counted as absent, until someone confirms it." },
  { key: "facilities_with_activity", section: "coverage", label: "Facilities with in-person activity", short: "different facilities", unit: "facilities", full: "Different facilities with at least one activity-day." },
  { key: "facilities_with_staff", section: "coverage", label: "Facilities with confirmed staff presence", short: "different facilities", unit: "facilities", full: "Different facilities with at least one day of confirmed staff presence." },
  { key: "facilities_engaged", section: "coverage", label: "Facilities engaged", short: "any contact", unit: "facilities", full: "Different facilities on any entry at all, calls and emails included. An entry with no facility never counts here." },
  // Programs
  { key: "programs", section: "programs", label: "Programs held", short: "each program once", unit: "entries", full: "Programs (including school and shul programs), each counted once." },
  { key: "program_residents", section: "programs", label: "Residents attending", short: "approx.", unit: "head count", approx: true, full: "The \"Residents reached\" numbers on programs added up. Someone at three programs counts three times." },
  { key: "not_split", section: "programs", label: "Not split (older entries)", short: "students and volunteers together", unit: "head count", approx: true, full: "Programs saved before students and volunteers were asked separately: the part of their one number not yet split. Never counted twice." },
  // School engagement
  { key: "school_programs", section: "school", label: "School programs", short: "with a school", unit: "entries", full: "Programs whose partner is filed as a school (and older \"School & shul\" entries marked school)." },
  { key: "schools_involved", section: "school", label: "Schools involved", short: "different schools", unit: "organizations", full: "Different schools named as the partner on a program." },
  { key: "students", section: "school", label: "Students at programs", short: "approx.", unit: "head count", approx: true, full: "Students who took part in programs, each group project once. Students are never counted as community volunteers." },
  { key: "chaperones", section: "school", label: "School staff / chaperones", short: "approx., at programs", unit: "head count", approx: true, full: "School staff and chaperones who came with a group, as typed in on programs (each group project once). Never counted as students or community volunteers." },
  { key: "student_volunteers", section: "school", label: "Students on volunteer visits", short: "different students", unit: "people", full: "Different volunteers filed as students named on a volunteer visit. Only someone filed as a student counts: being linked to a school isn't enough." },
  // Community volunteers
  { key: "volunteer_outings", section: "volunteers", label: "Volunteer outings", short: "each outing once", unit: "outings", full: "Each actual volunteer outing once, however many residents it saw. Two trips to the same facility on the same day are two outings. Entries saved before Nov 4, 2026 never said which outing they belonged to, so those are an ESTIMATE: entries with the same volunteers, facility and day are grouped as one outing (not verified trips)." },
  { key: "volunteers_active", section: "volunteers", label: "Community volunteers", short: "different people", unit: "people", full: "Different community volunteers named on a volunteer visit. Students and school staff are counted under School engagement." },
  { key: "volunteer_visits", section: "volunteers", label: "Volunteer visit entries", short: "one per resident", unit: "entries", full: "Volunteer visit entries: one per resident visited (or one group visit). Several entries can belong to one outing." },
  { key: "volunteer_residents", section: "volunteers", label: "Residents visited by volunteers", short: "different residents", unit: "people", full: "Different residents named on a volunteer visit." },
  { key: "program_volunteers", section: "volunteers", label: "Community volunteers at programs", short: "approx.", unit: "head count", approx: true, full: "Community volunteers who took part in programs, as typed in (each group project once). Students and school staff are counted apart." },
  // Food
  { key: "deliveries", section: "food", label: "Deliveries", short: "food deliveries", unit: "entries", full: "Food deliveries, each counted once." },
  { key: "food_people", section: "food", label: "People who received food", short: "approx.", unit: "head count", approx: true, full: "\"How many people received food?\" added up, from the deliveries where it was recorded." },
  { key: "food_not_recorded", section: "food", label: "People not recorded", short: "deliveries, unknown or blank", unit: "entries", full: "Deliveries where the number of people is unknown or wasn't recorded. They are never guessed or counted as 0." },
  // Family
  { key: "families", section: "family", label: "Families supported", short: "different families", unit: "people", full: "Different family members spoken with (or, if none is named, the resident whose family it was)." },
  { key: "family_conversations", section: "family", label: "Family conversations", short: "entries", unit: "entries", full: "Family support entries (older \"care navigation\" entries included)." },
  // Professional relationships
  { key: "staff_interactions", section: "professional", label: "Facility staff interactions", short: "per person, per conversation", unit: "entries", full: "Each facility staff person spoken with, once per entry. A staff conversation with nobody named counts once. Partners are never counted here." },
  { key: "staff_people", section: "professional", label: "Facility staff met", short: "different people", unit: "people", full: "Different facility staff people met." },
  { key: "staff_facilities", section: "professional", label: "Facilities", short: "where staff were met", unit: "facilities", full: "Different facilities where facility staff were met." },
  { key: "partner_conversations", section: "professional", label: "Partner conversations", short: "per person, per conversation", unit: "entries", full: "Conversations with schools, shuls, hospices, agencies and other partners, each person once per entry. Never counted as facility staff." },
  { key: "partner_people", section: "professional", label: "Partners spoken with", short: "different people", unit: "people", full: "Different partner people spoken with." },
  { key: "appreciation", section: "professional", label: "Staff appreciation", short: "activities", unit: "entries", full: "Food, refreshments or gifts brought to a facility's staff. Each delivery once, however many staff enjoyed it. Never a staff conversation or food assistance; the staff who brought it get a staff visit (Facility coverage)." },
  { key: "appreciation_facilities", section: "professional", label: "Facilities appreciated", short: "different facilities", unit: "facilities", full: "Different facilities that received staff appreciation." },
];

export const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

/** One entry behind a number, and how much it adds. */
export type RecordLine = { id: string; adds: number; person?: string | null; note?: string };

export type PersonRow = { id: string; name: string };

export type StaffTeamRow = PersonRow & {
  staffVisits: number;
  notRecorded: number;
  activities: number;
  coordinatedOnly: number;
};

export type VolunteerTeamRow = PersonRow & { outings: number; residents: number; visits: number; role: string | null };

export type ImpactNumbers = Record<string, number>;

export type ImpactMetrics = {
  values: ImpactNumbers;
  coverage: FacilityCoverage;
  staff: StaffTeamRow[];
  volunteers: VolunteerTeamRow[];
  /** Partners spoken with, by how they're filed. */
  partnersByType: { label: string; value: number }[];
  familyNeeds: { label: string; value: number }[];
  holidays: { key: string; label: string; value: number }[];
  /** Records behind each number (see recordsFor). */
  rows: MetricRow[];
};

export type Context = {
  engaged: EngagedLinks;
  partners: PartnerContacts;
  partnerTypes: Map<string, string>;
  team: TeamLinks;
  volunteers: VolunteerLinks;
  volunteerNames: Map<string, string>;
  /** "student" or "school_staff"; anyone else is a community volunteer. */
  volunteerRoles: Map<string, string>;
  staffNames: Map<string, string>;
};

const isCommunity = (ctx: Context, v: string) => !ctx.volunteerRoles.get(v) || ctx.volunteerRoles.get(v) === "community";

const ONE_ON_ONE = new Set(["resident_visit", "resident_phone_call", "volunteer_visit"]);
const REFERRALS = new Set(["medical_referral", "referral"]);
const FAMILY = new Set(["family_communication", "care_navigation"]);
const GROUP_VISIT = new Set(["resident_visit", "volunteer_visit"]);

/** Which records each number is made of, and how much each adds. A
 * facility-day number lists days instead (see coverageDaysFor). */
function recordLines(key: string, rows: MetricRow[], ctx: Context): RecordLine[] | null {
  const each = (filter: (r: MetricRow) => boolean, adds: (r: MetricRow) => number = () => 1, person?: (r: MetricRow) => string | null) =>
    rows.filter(filter).map((r) => ({ id: r.id, adds: adds(r), person: person?.(r) ?? null })).filter((l) => l.adds > 0 || person);
  switch (key) {
    case "residents_served":
      return each((r) => ONE_ON_ONE.has(r.interaction_type) && !!r.resident_id, () => 1, (r) => r.resident_id);
    case "resident_engagements":
      return each((r) => ONE_ON_ONE.has(r.interaction_type) && !!r.resident_id);
    case "referrals":
      return each((r) => REFERRALS.has(r.interaction_type));
    case "rides":
      return each((r) => r.interaction_type === "ride_arranged");
    case "staff_resident_visits":
      return each((r) => r.interaction_type === "resident_visit" && !!r.resident_id);
    case "phone_calls":
      return each((r) => r.interaction_type === "resident_phone_call");
    case "volunteer_resident_visits":
      return each((r) => r.interaction_type === "volunteer_visit" && !!r.resident_id);
    case "group_visits":
      return each((r) => GROUP_VISIT.has(r.interaction_type) && !r.resident_id);
    case "group_visit_reached":
      return each((r) => GROUP_VISIT.has(r.interaction_type) && !r.resident_id && (r.people_reached ?? 0) > 0, (r) => r.people_reached ?? 0);
    case "programs":
      return each((r) => GROUP_PROJECT_TYPES.has(r.interaction_type));
    case "program_residents":
      return each((r) => GROUP_PROJECT_TYPES.has(r.interaction_type), (r) => r.people_reached ?? 0);
    case "not_split":
      return each((r) => groupCountsFor(r).notSplit > 0, (r) => groupCountsFor(r).notSplit);
    case "school_programs":
      return each((r) => isSchoolProgram(r));
    case "schools_involved":
      return each((r) => isSchoolProgram(r), () => 1, (r) => r.partner_organization_id ?? null);
    case "students":
      return each((r) => groupCountsFor(r).students > 0, (r) => groupCountsFor(r).students);
    case "chaperones":
      return each((r) => groupCountsFor(r).chaperones > 0, (r) => groupCountsFor(r).chaperones);
    case "student_volunteers":
      return rows
        .filter((r) => r.interaction_type === "volunteer_visit")
        .flatMap((r) =>
          (ctx.volunteers.get(r.id) ?? []).filter((v) => ctx.volunteerRoles.get(v) === "student").map((v) => ({ id: r.id, adds: 1, person: v, note: ctx.volunteerNames.get(v) }))
        );
    case "volunteers_active":
      return rows
        .filter((r) => r.interaction_type === "volunteer_visit")
        .flatMap((r) =>
          (ctx.volunteers.get(r.id) ?? []).filter((v) => isCommunity(ctx, v)).map((v) => ({ id: r.id, adds: 1, person: v, note: ctx.volunteerNames.get(v) }))
        );
    case "volunteer_outings": {
      // Each outing once: the first of its entries adds 1, the rest 0.
      const seen = new Set<string>();
      return rows
        .filter((r) => r.interaction_type === "volunteer_visit")
        .map((r) => {
          const k = volunteerOutingKey(r, ctx.volunteers)!;
          const first = !seen.has(k);
          seen.add(k);
          return { id: r.id, adds: first ? 1 : 0, person: k, note: first ? undefined : "Same outing, already counted" };
        });
    }
    case "volunteer_visits":
      return each((r) => r.interaction_type === "volunteer_visit");
    case "volunteer_residents":
      return each((r) => r.interaction_type === "volunteer_visit" && !!r.resident_id, () => 1, (r) => r.resident_id);
    case "program_volunteers":
      return each((r) => groupCountsFor(r).volunteers > 0, (r) => groupCountsFor(r).volunteers);
    case "deliveries":
      return each((r) => r.interaction_type === "food_delivery");
    case "food_people":
      return each((r) => r.interaction_type === "food_delivery" && r.people_reached !== null, (r) => r.people_reached ?? 0);
    case "food_not_recorded":
      return each((r) => r.interaction_type === "food_delivery" && r.people_reached === null);
    case "families":
      return each((r) => FAMILY.has(r.interaction_type), () => 1, (r) => r.contact_id ?? r.resident_id);
    case "family_conversations":
      return each((r) => FAMILY.has(r.interaction_type));
    case "staff_interactions":
      return each((r) => staffInteractionFor(r, ctx.engaged, ctx.partners) > 0, (r) => staffInteractionFor(r, ctx.engaged, ctx.partners));
    case "staff_people":
    case "staff_facilities":
      return rows.flatMap((r) =>
        [...staffPeopleOn(r, ctx.engaged, ctx.partners)].map((p) => ({ id: r.id, adds: 1, person: key === "staff_people" ? p : r.facility_id }))
      );
    case "partner_conversations":
      return each((r) => partnerConversationsFor(r, ctx.engaged, ctx.partners) > 0, (r) => partnerConversationsFor(r, ctx.engaged, ctx.partners));
    case "partner_people":
      return rows.flatMap((r) => [...partnerPeopleOn(r, ctx.engaged, ctx.partners)].map((p) => ({ id: r.id, adds: 1, person: p })));
    case "appreciation":
      return each((r) => r.interaction_type === "staff_appreciation");
    case "appreciation_facilities":
      return each((r) => r.interaction_type === "staff_appreciation" && !!r.facility_id, () => 1, (r) => r.facility_id);
    case "attendance_not_recorded":
      // Older programs and deliveries at a facility whose staff attendance
      // isn't recorded; the ones that decide a facility-day first.
      return rows
        .filter((r) => (ATTENDANCE_TYPES.has(r.interaction_type) || r.interaction_type === "volunteer_visit") && staffAttendance(r, ctx.team).unverified.length > 0)
        .map((r) => ({ id: r.id, adds: 1 }));
  }
  if (key.startsWith("staff:")) {
    const who = key.slice(6);
    return rows
      .filter((r) => r.staff_member_id === who || (ctx.team.get(r.id) ?? []).includes(who))
      .map((r) => {
        const att = staffAttendance(r, ctx.team);
        const role =
          r.staff_member_id === who && coordinatedOnly(r, ctx.team)
            ? "Coordinated only"
            : att.confirmed.includes(who)
              ? "There (confirmed)"
              : att.unverified.includes(who)
                ? "Attendance not recorded"
                : r.staff_member_id === who
                  ? "Did it"
                  : "On the team";
        return { id: r.id, adds: 1, note: role };
      });
  }
  if (key.startsWith("volunteer:")) {
    const who = key.slice(10);
    return rows
      .filter((r) => r.interaction_type === "volunteer_visit" && (ctx.volunteers.get(r.id) ?? []).includes(who))
      .map((r) => ({ id: r.id, adds: 1 }));
  }
  return null;
}

const distinct = (lines: RecordLine[]) => new Set(lines.map((l) => l.person).filter(Boolean)).size;
const total = (lines: RecordLine[]) => lines.reduce((s, l) => s + l.adds, 0);

/** The calculation itself (exported for the offline October check). */
export function computeImpactMetrics(rows: MetricRow[], ctx: Context): ImpactMetrics {
  return compute(rows, ctx);
}

function compute(rows: MetricRow[], ctx: Context): ImpactMetrics {
  const coverage = facilityCoverage(rows, ctx.team);
  const lines = (key: string) => recordLines(key, rows, ctx) ?? [];
  const values: ImpactNumbers = {};
  for (const m of METRICS) {
    switch (m.key) {
      case "activity_days":
        values[m.key] = coverage.activityDays;
        break;
      case "staff_confirmed_days":
        values[m.key] = coverage.staffConfirmedDays;
        break;
      case "not_recorded_days":
        values[m.key] = coverage.notRecordedDays;
        break;
      case "no_staff_days":
        values[m.key] = coverage.noStaffDays;
        break;
      case "staff_visits_confirmed":
        values[m.key] = coverage.staffVisitsConfirmed;
        break;
      case "staff_visits_not_recorded":
        values[m.key] = coverage.staffVisitsNotRecorded;
        break;
      case "facilities_with_activity":
        values[m.key] = coverage.facilitiesWithActivity;
        break;
      case "facilities_with_staff":
        values[m.key] = coverage.facilitiesWithStaff;
        break;
      case "facilities_engaged":
        values[m.key] = coverage.facilitiesEngaged;
        break;
      case "volunteer_outings": {
        const keys = volunteerOutingKeys(rows, ctx.volunteers);
        values[m.key] = keys.size;
        // How many of them are grouped from older entries (an estimate).
        values.volunteer_outings_estimated = [...keys].filter((k) => k.startsWith("older|")).length;
        break;
      }
      default:
        values[m.key] = m.unit === "people" || m.unit === "facilities" || m.unit === "organizations" ? distinct(lines(m.key)) : total(lines(m.key));
    }
  }
  values.programs_at_facility = rows.filter((r) => GROUP_PROJECT_TYPES.has(r.interaction_type) && r.facility_id).length;
  values.programs_elsewhere = values.programs - values.programs_at_facility;
  values.schools_not_named = rows.filter((r) => isSchoolProgram(r) && !r.partner_organization_id).length;
  values.attendance_not_recorded_entries = lines("attendance_not_recorded").length;

  // Team: each staff member's confirmed visits, activities, coordinated only.
  const staffIds = new Set<string>();
  for (const r of rows) {
    if (r.staff_member_id) staffIds.add(r.staff_member_id);
    (ctx.team.get(r.id) ?? []).forEach((p) => staffIds.add(p));
  }
  const staff: StaffTeamRow[] = [...staffIds].map((id) => {
    let activities = 0;
    let coordinated = 0;
    for (const r of rows) {
      const lead = r.staff_member_id === id;
      const onTeam = (ctx.team.get(r.id) ?? []).includes(id);
      if (!lead && !onTeam) continue;
      if (lead && !onTeam && coordinatedOnly(r, ctx.team)) coordinated += 1;
      else activities += 1;
    }
    const prefix = `${id}|`;
    return {
      id,
      name: ctx.staffNames.get(id) ?? "Unknown",
      staffVisits: [...coverage.confirmedVisitKeys].filter((k) => k.startsWith(prefix)).length,
      notRecorded: [...coverage.notRecordedVisitKeys].filter((k) => k.startsWith(prefix)).length,
      activities,
      coordinatedOnly: coordinated,
    };
  });
  staff.sort((a, b) => b.staffVisits - a.staffVisits || b.activities - a.activities);

  const volunteerIds = new Set<string>();
  rows.filter((r) => r.interaction_type === "volunteer_visit").forEach((r) => (ctx.volunteers.get(r.id) ?? []).forEach((v) => volunteerIds.add(v)));
  const volunteers: VolunteerTeamRow[] = [...volunteerIds].map((id) => {
    const theirs = rows.filter((r) => r.interaction_type === "volunteer_visit" && (ctx.volunteers.get(r.id) ?? []).includes(id));
    return {
      id,
      name: ctx.volunteerNames.get(id) ?? "Unknown volunteer",
      outings: volunteerOutingKeys(theirs, ctx.volunteers).size,
      residents: new Set(theirs.map((r) => r.resident_id).filter(Boolean)).size,
      visits: theirs.length,
      role: ctx.volunteerRoles.get(id) ?? null,
    };
  });
  volunteers.sort((a, b) => b.outings - a.outings || b.visits - a.visits);

  const partnerCounts = new Map<string, Set<string>>();
  for (const l of lines("partner_people")) {
    const type = ctx.partnerTypes.get(l.person ?? "") ?? "community_partner";
    const set = partnerCounts.get(type) ?? new Set<string>();
    set.add(l.person!);
    partnerCounts.set(type, set);
  }
  const partnersByType = [...partnerCounts].map(([type, set]) => ({ label: labelFor(CONTACT_TYPES, type), value: set.size }));

  const needCounts = new Map<string, number>();
  for (const r of rows) if (r.family_need) needCounts.set(r.family_need, (needCounts.get(r.family_need) ?? 0) + 1);
  const familyNeeds = FAMILY_NEEDS.filter((f) => needCounts.has(f.value)).map((f) => ({ label: f.label, value: needCounts.get(f.value)! }));

  // Holidays: residents reached per holiday (a one-on-one visit counts 1).
  const holidayCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.holiday) continue;
    const reached = r.people_reached ?? (r.resident_id ? 1 : 0);
    holidayCounts.set(r.holiday, (holidayCounts.get(r.holiday) ?? 0) + reached);
  }
  const holidays = HOLIDAYS.filter((h) => holidayCounts.has(h.value)).map((h) => ({ key: h.value, label: h.label, value: holidayCounts.get(h.value)! }));

  return { values, coverage, staff, volunteers, partnersByType, familyNeeds, holidays, rows };
}

const ROW_COLUMNS =
  "id, interaction_type, occurred_at, staff_member_id, entered_by, resident_id, contact_id, facility_id, people_reached, holiday, family_need, participants, student_count, volunteer_count, chaperone_count, outing_id, part_of_id, counted_in_id, in_person, method, voided_at, lead_attended, program_partner, partner_organization_id, organizations(organization_type)";

type FetchedRow = Omit<MetricRow, "partner_org_type"> & { organizations: { organization_type: string | null } | null };

async function fetchRows(supabase: Awaited<ReturnType<typeof createClient>>, fromIso: string | null, toIso: string | null): Promise<MetricRow[]> {
  const rows = await selectAllPages<FetchedRow>((from, to) => {
    let q = supabase.from("interactions").select(ROW_COLUMNS).order("id").range(from, to);
    if (fromIso) q = q.gte("occurred_at", fromIso);
    if (toIso) q = q.lt("occurred_at", toIso);
    return q as unknown as PromiseLike<{ data: FetchedRow[] | null; error: { message: string } | null }>;
  });
  return rows.map(({ organizations, ...r }) => ({ ...r, partner_org_type: organizations?.organization_type ?? null }));
}

async function fetchContext(supabase: Awaited<ReturnType<typeof createClient>>, fromIso: string | null): Promise<Context> {
  const [engaged, partnerRows, team, volunteerRows, profiles] = await Promise.all([
    fetchEngagedLinks(supabase, fromIso),
    selectAllPages<{ id: string; contact_type: string }>((from, to) =>
      supabase.from("contacts").select("id, contact_type").in("contact_type", [...PARTNER_CONTACT_TYPES]).order("id").range(from, to)
    ),
    fetchTeamLinks(supabase),
    selectAllPages<{ interaction_id: string; contact_id: string; contacts: { name: string; volunteer_role: string | null } | null }>((from, to) =>
      supabase
        .from("interaction_volunteers")
        .select("interaction_id, contact_id, contacts(name, volunteer_role)")
        .order("interaction_id")
        .order("contact_id")
        .range(from, to) as unknown as PromiseLike<{
        data: { interaction_id: string; contact_id: string; contacts: { name: string; volunteer_role: string | null } | null }[] | null;
        error: { message: string } | null;
      }>
    ),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const volunteers: VolunteerLinks = new Map();
  const volunteerNames = new Map<string, string>();
  const volunteerRoles = new Map<string, string>();
  for (const v of volunteerRows) {
    volunteers.set(v.interaction_id, [...(volunteers.get(v.interaction_id) ?? []), v.contact_id]);
    if (v.contacts?.name) volunteerNames.set(v.contact_id, v.contacts.name);
    if (v.contacts?.volunteer_role) volunteerRoles.set(v.contact_id, v.contacts.volunteer_role);
  }
  return {
    engaged,
    partners: new Set(partnerRows.map((p) => p.id)),
    partnerTypes: new Map(partnerRows.map((p) => [p.id, p.contact_type])),
    team,
    volunteers,
    volunteerNames,
    volunteerRoles,
    staffNames: new Map(((profiles.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])),
  };
}

async function loadPeriod(period: ReportPeriod, facilityId?: string): Promise<{ metrics: ImpactMetrics; ctx: Context }> {
  const supabase = await createClient();
  const bounds = periodBounds(period);
  const [all, ctx] = await Promise.all([fetchRows(supabase, bounds.start, bounds.end), fetchContext(supabase, bounds.start)]);
  const rows = all.filter((r) => isCounted(r) && (!facilityId || r.facility_id === facilityId));
  return { metrics: compute(rows, ctx), ctx };
}

/** The numbers for one period (optionally one facility's entries only). */
export async function getImpactMetrics(period: ReportPeriod, facilityId?: string): Promise<ImpactMetrics> {
  return (await loadPeriod(period, facilityId)).metrics;
}

/** The records behind one number, for its list. */
export async function getMetricRecords(
  period: ReportPeriod,
  key: string,
  facilityId?: string
): Promise<{ lines: RecordLine[] | null; days: CoverageDay[] | null; value: number | null; metrics: ImpactMetrics }> {
  const { metrics, ctx } = await loadPeriod(period, facilityId);
  const dayStatus: Record<string, CoverageDay["status"] | "any"> = {
    activity_days: "any",
    staff_confirmed_days: "staff",
    not_recorded_days: "not_recorded",
    no_staff_days: "no_staff",
    facilities_with_activity: "any",
    facilities_with_staff: "staff",
    staff_visits_confirmed: "staff",
    staff_visits_not_recorded: "not_recorded",
  };
  if (key in dayStatus) {
    const want = dayStatus[key];
    const days = metrics.coverage.days.filter((d) =>
      key === "staff_visits_confirmed"
        ? d.confirmedStaff.length > 0
        : key === "staff_visits_not_recorded"
          ? d.unverifiedStaff.length > 0
          : want === "any" || d.status === want
    );
    return { lines: null, days, value: metrics.values[key] ?? null, metrics };
  }
  if (key === "facilities_engaged") {
    return { lines: metrics.rows.filter((r) => r.facility_id).map((r) => ({ id: r.id, adds: 1, person: r.facility_id })), days: null, value: metrics.values[key], metrics };
  }
  let lines = recordLines(key, metrics.rows, ctx);
  if (key === "attendance_not_recorded" && lines) {
    // The entries that decide a facility-day first.
    const deciding = new Set(metrics.coverage.days.filter((d) => d.status === "not_recorded").flatMap((d) => d.ids));
    lines = lines.map((l) => ({ ...l, note: deciding.has(l.id) ? "Decides a facility-day" : undefined }));
    lines.sort((a, b) => Number(!!b.note) - Number(!!a.note));
  }
  return { lines, days: null, value: metrics.values[key] ?? null, metrics };
}

// --- The Impact page: sections plus charts and the today band ----------------

export type MonthBar = { label: string; values: number[]; href?: string };
export type LabeledValue = { label: string; value: number; href?: string; color?: string };

export type ImpactPageData = {
  metrics: ImpactMetrics;
  previous: ImpactNumbers | null;
  /** Corrected (voided or reviewed-as-copy) entries in the period, and
   * the four headline numbers as first recorded. */
  corrections: { entries: number; asFirstRecorded: ImpactNumbers } | null;
  visitsByMonth: MonthBar[];
  familyByMonth: MonthBar[];
  staffByMonth: MonthBar[];
  recency: LabeledValue[];
  activeResidents: number;
  notVisited30: number;
  /** Of those without an in-person visit in 30+ days, a call in the last 30. */
  calledRecently: number;
  withFamily: number;
  stages: LabeledValue[];
  facilitiesTotal: number;
  noJewishResidentsKnown: number;
  topFacilities: LabeledValue[];
};

/** "/impact/records?metric=x&period=y" -- the list behind a number. */
export function recordsHref(key: string, period: ReportPeriod, facilityId?: string): string {
  const q = new URLSearchParams({ metric: key, period: period.key });
  if (period.key.includes("..") && period.from && period.to) {
    q.delete("period");
    q.set("from", period.from);
    q.set("to", period.to);
  }
  if (facilityId) q.set("facility", facilityId);
  return `/impact/records?${q.toString()}`;
}

export async function getImpactPage(period: ReportPeriod): Promise<ImpactPageData> {
  const supabase = await createClient();
  const bounds = periodBounds(period);
  const prevPeriod = previousPeriod(period);
  const prev = prevPeriod ? periodBounds(prevPeriod) : null;
  const months = monthsOf(period);
  const monthsStart = periodBounds(months[0]).start!;
  const monthsEnd = periodBounds(months[months.length - 1]).end!;
  const fetchFrom = period.from ? [monthsStart, prev?.start ?? monthsStart, bounds.start!].sort()[0] : null;
  const fetchTo = period.to ? [monthsEnd, bounds.end!].sort()[1] : null;

  const [allRows, ctx, residents, links, facilities] = await Promise.all([
    fetchRows(supabase, fetchFrom, fetchTo),
    fetchContext(supabase, fetchFrom),
    selectAllPages<{ id: string; status: string; last_visit_at: string | null; last_contact_at: string | null }>((from, to) =>
      supabase.from("resident_summary").select("id, status, last_visit_at, last_contact_at").order("id").range(from, to)
    ),
    selectAllPages<{ resident_id: string }>((from, to) =>
      supabase.from("resident_contacts").select("resident_id").eq("active", true).order("id").range(from, to)
    ),
    selectAllPages<{ id: string; name: string; engagement_status: string }>((from, to) =>
      supabase.from("facilities").select("id, name, engagement_status").eq("active", true).order("id").range(from, to)
    ),
  ]);

  const counted = allRows.filter((r) => isCounted(r));
  const inThis = counted.filter((r) => inPeriod(r.occurred_at, bounds));
  const metrics = compute(inThis, ctx);
  const previous = prev ? compute(counted.filter((r) => inPeriod(r.occurred_at, prev)), ctx).values : null;
  const allInPeriod = allRows.filter((r) => inPeriod(r.occurred_at, bounds));
  const correctedEntries = allInPeriod.length - inThis.length;
  const corrections = correctedEntries > 0 ? { entries: correctedEntries, asFirstRecorded: compute(allInPeriod, ctx).values } : null;

  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  const monthLabel = (m: ReportPeriod) =>
    new Date(Date.UTC(Number(m.key.slice(0, 4)), Number(m.key.slice(5, 7)) - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const visitsByMonth = months.map((m) => ({ label: monthLabel(m), values: [0, 0], href: recordsHref("residents_served", m) }));
  const familyByMonth = months.map((m) => ({ label: monthLabel(m), values: [0], href: recordsHref("family_conversations", m) }));
  const staffByMonth = months.map((m) => ({ label: monthLabel(m), values: [0], href: recordsHref("staff_interactions", m) }));
  for (const r of counted) {
    const i = monthIndex.get(orgMonthKey(r.occurred_at));
    if (i === undefined) continue;
    // The same definition as "Residents served one-on-one": a named resident.
    if ((r.interaction_type === "resident_visit" || r.interaction_type === "resident_phone_call") && r.resident_id) visitsByMonth[i].values[0] += 1;
    if (r.interaction_type === "volunteer_visit" && r.resident_id) visitsByMonth[i].values[1] += 1;
    if (FAMILY.has(r.interaction_type)) familyByMonth[i].values[0] += 1;
    staffByMonth[i].values[0] += staffInteractionFor(r, ctx.engaged, ctx.partners);
  }

  // Today: time since the last in-person visit (active residents).
  const active = residents.filter((r) => (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status));
  const day = 24 * 60 * 60 * 1000;
  const ageOf = (v: string | null) => (v ? (Date.now() - new Date(v).getTime()) / day : null);
  const recencyCounts = [0, 0, 0, 0];
  let calledRecently = 0;
  for (const r of active) {
    const age = ageOf(r.last_visit_at);
    if (age === null) recencyCounts[3] += 1;
    else recencyCounts[age < 30 ? 0 : age < 90 ? 1 : 2] += 1;
    const contactAge = ageOf(r.last_contact_at);
    if ((age === null || age >= 30) && contactAge !== null && contactAge < 30) calledRecently += 1;
  }
  const recency = ["Under 30 days", "30–90 days", "90+ days", "No in-person visit yet"].map((label, i) => ({
    label,
    value: recencyCounts[i],
    href: i === 0 ? "/residents" : "/needs-attention",
  }));
  const activeIds = new Set(active.map((r) => r.id));
  const withFamily = new Set(links.map((l) => l.resident_id).filter((id) => activeIds.has(id))).size;

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

  const nameOf = new Map(facilities.map((f) => [f.id, f.name]));
  const perFacility = new Map<string, number>();
  for (const r of inThis) {
    const c = staffInteractionFor(r, ctx.engaged, ctx.partners);
    if (c > 0 && r.facility_id) perFacility.set(r.facility_id, (perFacility.get(r.facility_id) ?? 0) + c);
  }
  const topFacilities = [...perFacility.entries()]
    .filter(([id]) => nameOf.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, value]) => ({ label: nameOf.get(id)!, value, href: recordsHref("staff_interactions", period, id) }));

  return {
    metrics,
    previous,
    corrections,
    visitsByMonth,
    familyByMonth,
    staffByMonth,
    recency,
    activeResidents: active.length,
    notVisited30: recencyCounts[1] + recencyCounts[2] + recencyCounts[3],
    calledRecently,
    withFamily,
    stages,
    facilitiesTotal: facilities.length,
    noJewishResidentsKnown,
    topFacilities,
  };
}

/** A quarter's numbers as first recorded (voided and reviewed copies
 * included), for the one-time snapshot before its first correction. The
 * metric names are the ones already saved for earlier quarters. */
export async function snapshotAsFirstRecorded(fromIso: string, toIso: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const [rows, ctx] = await Promise.all([fetchRows(supabase, fromIso, toIso), fetchContext(supabase, fromIso)]);
  const m = compute(rows, ctx);
  const v = m.values;
  const groups = rows.reduce(
    (s, r) => {
      const g = groupCountsFor(r);
      return { students: s.students + g.students, volunteers: s.volunteers + g.volunteers, notSplit: s.notSplit + g.notSplit };
    },
    { students: 0, volunteers: 0, notSplit: 0 }
  );
  return {
    one_on_one_visits_and_calls: v.staff_resident_visits + v.phone_calls + v.volunteer_resident_visits,
    residents_served: v.residents_served,
    family_conversations: v.family_conversations,
    families: v.families,
    staff_engagements: v.staff_interactions,
    staff_people: v.staff_people,
    programs: v.programs,
    deliveries: v.deliveries,
    reached: rows.reduce((s, r) => s + (r.people_reached ?? 0), 0),
    facility_visit_days: v.staff_confirmed_days + v.not_recorded_days,
    volunteer_only_days: v.no_staff_days,
    facility_presence_days: v.activity_days,
    facilities_visited: v.facilities_with_activity,
    facilities_engaged: v.facilities_engaged,
    group_volunteers: groups.volunteers,
    staff_visits: v.staff_visits_confirmed + v.staff_visits_not_recorded,
    partner_conversations: v.partner_conversations,
    group_students: groups.students,
    group_not_split: groups.notSplit,
    // Nov 3, 2026.
    staff_confirmed_days: v.staff_confirmed_days,
    staff_visits_confirmed: v.staff_visits_confirmed,
  };
}

/** Staff attendance in words, for an entry's page. */
export function attendanceLabel(r: { interaction_type: string; lead_attended?: boolean | null }): string | null {
  if (r.interaction_type === "volunteer_visit")
    return r.lead_attended === true ? "Went too" : r.lead_attended === false ? "Arranged it (didn't go)" : "Staff attendance not recorded";
  if (!ATTENDANCE_TYPES.has(r.interaction_type)) return null;
  return r.lead_attended === true ? "Staff were there" : r.lead_attended === false ? "No staff were there" : "Staff attendance not recorded";
}

/** "2026-Q4" and its Cleveland start/end, for the quarter a moment falls in. */
export function quarterOf(value: string): { key: string; from: string; to: string } {
  const [y, m] = orgMonthKey(value).split("-").map(Number);
  const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
  const next = firstMonth + 3 > 12 ? { y: y + 1, m: 1 } : { y, m: firstMonth + 3 };
  const pad = (x: number) => String(x).padStart(2, "0");
  return {
    key: `${y}-Q${Math.floor((m - 1) / 3) + 1}`,
    from: orgDayStartIso(`${y}-${pad(firstMonth)}-01`)!,
    to: orgDayStartIso(`${next.y}-${pad(next.m)}-01`)!,
  };
}
