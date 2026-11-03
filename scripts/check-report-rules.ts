/**
 * Offline check of the October 27 counting rules (no database): feeds
 * made-up entries through the same functions the Impact page and the
 * funder export use, and prints PASS/FAIL for each rule.
 * Run with: npx tsx scripts/check-report-rules.ts
 */
import {
  coordinatedOnly,
  facilityCoverage,
  facilityPresence,
  isSchoolProgram,
  staffAttendance,
  volunteerFacilityDayKeys,
  volunteerOutingKeys,
  groupCountsFor,
  partnerConversationsFor,
  staffInteractionFor,
  staffInteractions,
  staffVisits,
  type CountableRow,
  type EngagedLinks,
  type TeamLinks,
} from "../src/lib/queries/report-rules";
import {
  headCount,
  serviceNumbersLine,
  MORE_TYPES,
  FACILITY_OPTIONAL_TYPES,
  ONE_PER_PERSON_TYPES,
  NO_FACILITY_RESIDENT_TYPES,
  ATTENDANCE_ASKED_TYPES,
} from "../src/lib/domain/interaction";
import { computeImpactMetrics, type Context, type MetricRow } from "../src/lib/queries/impact-metrics";
import { logHref } from "../src/components/log-button";

const STAFF_A = "staff-a";
const STAFF_B = "staff-b";
const LISA = "contact-lisa"; // facility staff
const TOM = "contact-tom"; // facility staff
const DANA = "contact-dana"; // hospice (community partner)
const RABBI = "contact-rabbi"; // rabbi / shul
const partners = new Set([DANA, RABBI]);

let n = 0;
const row = (r: Partial<CountableRow> & { interaction_type: string }): CountableRow => ({
  id: `row-${++n}`,
  occurred_at: "2026-10-20T16:00:00Z",
  facility_id: "facility-1",
  contact_id: null,
  staff_member_id: STAFF_A,
  ...r,
});

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok || detail === undefined ? "" : ` -- got ${JSON.stringify(detail)}`}`);
}

// --- Staff interactions: one per person ------------------------------------
const noLinks: EngagedLinks = new Map();
const staffTalk = row({ interaction_type: "facility_staff_communication", contact_id: LISA });
check("staff conversation with one staff member = 1", staffInteractionFor(staffTalk, noLinks, partners) === 1);

const olderShared = row({ interaction_type: "facility_staff_communication", contact_id: LISA });
const sharedLinks: EngagedLinks = new Map([[olderShared.id, new Set([LISA, TOM])]]);
check(
  "older entry with two staff on it = 2 (one per person, no meetings number)",
  staffInteractionFor(olderShared, sharedLinks, partners) === 2,
  staffInteractionFor(olderShared, sharedLinks, partners)
);

const nobody = row({ interaction_type: "facility_staff_communication" });
check("staff conversation with nobody named still = 1", staffInteractionFor(nobody, noLinks, partners) === 1);

const twoRecords = [
  row({ interaction_type: "facility_staff_communication", contact_id: LISA }),
  row({ interaction_type: "facility_staff_communication", contact_id: TOM }),
];
const totals = staffInteractions(twoRecords, noLinks, partners);
check("two one-person records = 2 interactions, 2 people", totals.interactions === 2 && totals.people === 2, totals);

// --- Partners ----------------------------------------------------------------
const hospiceAsStaffTalk = row({ interaction_type: "facility_staff_communication", contact_id: DANA, facility_id: null });
check("staff conversation with a hospice contact: 0 facility staff", staffInteractionFor(hospiceAsStaffTalk, noLinks, partners) === 0);
check("... and 1 partner conversation", partnerConversationsFor(hospiceAsStaffTalk, noLinks, partners) === 1);

const hospiceAsOther = row({ interaction_type: "other", contact_id: DANA, facility_id: null });
check("'Other' with a hospice contact = 1 partner conversation", partnerConversationsFor(hospiceAsOther, noLinks, partners) === 1);
check("'Other' with a hospice contact: 0 facility staff", staffInteractionFor(hospiceAsOther, noLinks, partners) === 0);

const otherWithFamily = row({ interaction_type: "other", contact_id: "contact-family" });
check("'Other' with someone not a partner counts as neither", partnerConversationsFor(otherWithFamily, noLinks, partners) === 0 && staffInteractionFor(otherWithFamily, noLinks, partners) === 0);

const mixed = row({ interaction_type: "facility_staff_communication", contact_id: LISA });
const mixedLinks: EngagedLinks = new Map([[mixed.id, new Set([LISA, RABBI])]]);
check(
  "older entry with a staff member and a rabbi: 1 staff + 1 partner",
  staffInteractionFor(mixed, mixedLinks, partners) === 1 && partnerConversationsFor(mixed, mixedLinks, partners) === 1
);

// --- Staff visits: each staff member once per facility per day -------------
const team: TeamLinks = new Map();
const visitA1 = row({ interaction_type: "resident_visit", staff_member_id: STAFF_A, method: "in_person" });
const visitA2 = row({ interaction_type: "resident_visit", staff_member_id: STAFF_A, method: "in_person", occurred_at: "2026-10-20T19:00:00Z" });
const visitB = row({ interaction_type: "resident_visit", staff_member_id: STAFF_B, method: "in_person" });
check("same person, same facility, same day, two entries = 1 staff visit", staffVisits([visitA1, visitA2], team) === 1);
check("two staff at the same facility the same day = 2 staff visits", staffVisits([visitA1, visitB], team) === 2);
check("... but still 1 facility visit-day", facilityPresence([visitA1, visitB]).staffVisitDays === 1);

const together = row({ interaction_type: "resident_visit", staff_member_id: STAFF_A, method: "in_person" });
team.set(together.id, [STAFF_B]);
check("one entry, lead + team member = 2 staff visits", staffVisits([together], team) === 2);

const otherFacility = row({ interaction_type: "resident_visit", staff_member_id: STAFF_A, method: "in_person", facility_id: "facility-2" });
check("same person, two facilities the same day = 2 staff visits", staffVisits([visitA1, otherFacility], new Map()) === 2);

const volunteerOnly = row({ interaction_type: "volunteer_visit", staff_member_id: STAFF_A, method: "in_person" });
check("volunteer-only visit = 0 staff visits (no staff credit)", staffVisits([volunteerOnly], new Map()) === 0);
check("... and still counts as a volunteer-only day", facilityPresence([volunteerOnly]).volunteerOnlyDays === 1);

const phone = row({ interaction_type: "facility_staff_communication", contact_id: LISA, method: "phone" });
check("phone call = 0 staff visits", staffVisits([phone], new Map()) === 0);

const partnerNoFacility = row({ interaction_type: "facility_staff_communication", contact_id: DANA, facility_id: null, method: "in_person_elsewhere" });
check("partner conversation never makes a facility visit", staffVisits([partnerNoFacility], new Map()) === 0 && facilityPresence([partnerNoFacility]).staffVisitDays === 0);

// --- Programs: students, volunteers, not split -------------------------------
const newProgram = row({ interaction_type: "program", student_count: 12, volunteer_count: 3 });
check("new program: 12 students, 3 volunteers", JSON.stringify(groupCountsFor(newProgram)) === JSON.stringify({ students: 12, volunteers: 3, chaperones: 0, notSplit: 0 }));
const oldProgram = row({ interaction_type: "school_engagement", participants: 20 });
check("older program's single number is 'not split'", JSON.stringify(groupCountsFor(oldProgram)) === JSON.stringify({ students: 0, volunteers: 0, chaperones: 0, notSplit: 20 }));
const partOf = row({ interaction_type: "program", student_count: 5, part_of_id: newProgram.id });
check("an activity 'Part of' a project adds no head count", groupCountsFor(partOf).students === 0);
check("head count: students + volunteers + only the unsplit part of an older number", headCount({ participants: 10, student_count: 3, volunteer_count: 4 }) === 10 && headCount({ participants: 2, student_count: 3, volunteer_count: 4 }) === 7);
check(
  "card for a split older program never shows the old number again",
  serviceNumbersLine({ interaction_type: "program", people_reached: null, participants: 90, student_count: 90 }) === "90 students"
);


// --- Final cleanup batch (Nov 3, 2026) ----------------------------------------
// Q6: an older single number counts only for the part not yet split.
check(
  "older program edited to 90 students (old number 90): 90 students, 0 not split -- never 180",
  JSON.stringify(groupCountsFor(row({ interaction_type: "program", participants: 90, student_count: 90 }))) ===
    JSON.stringify({ students: 90, volunteers: 0, chaperones: 0, notSplit: 0 })
);
check(
  "older 30, then 20 students entered: 20 students + 10 not split (nothing lost)",
  JSON.stringify(groupCountsFor(row({ interaction_type: "program", participants: 30, student_count: 20 }))) ===
    JSON.stringify({ students: 20, volunteers: 0, chaperones: 0, notSplit: 10 })
);

// D4 / C2: staff attendance on programs and food.
const noTeam: TeamLinks = new Map();
const oldProgramAtFacility = row({ interaction_type: "program", staff_member_id: STAFF_A, method: null });
check("older program, attendance not recorded: no confirmed staff, 1 not recorded", JSON.stringify(staffAttendance(oldProgramAtFacility, noTeam)) === JSON.stringify({ confirmed: [], unverified: [STAFF_A] }));
const confirmedFood = row({ interaction_type: "food_delivery", staff_member_id: STAFF_A, method: "in_person", lead_attended: true });
check("delivery with staff recorded there: confirmed", staffAttendance(confirmedFood, noTeam).confirmed.length === 1);
const noStaffProgram = row({ interaction_type: "program", staff_member_id: STAFF_A, method: "in_person", lead_attended: false, facility_id: "facility-9" });
check("program with no staff there: nobody credited", JSON.stringify(staffAttendance(noStaffProgram, noTeam)) === JSON.stringify({ confirmed: [], unverified: [] }));
check("... and whoever entered it is 'coordinated only'", coordinatedOnly(noStaffProgram, noTeam));

const cov = facilityCoverage(
  [
    row({ interaction_type: "program", facility_id: "f-old", method: null }),
    row({ interaction_type: "resident_visit", facility_id: "f-visit", method: "in_person" }),
    row({ interaction_type: "volunteer_visit", facility_id: "f-vol", method: "in_person" }),
    noStaffProgram,
    row({ interaction_type: "resident_phone_call", facility_id: "f-call", method: "phone" }),
  ],
  noTeam
);
check("coverage: 4 activity-days (a call is never one)", cov.activityDays === 4, cov.activityDays);
// An older volunteer visit never said whether staff went: not recorded,
// never "no staff there" (director, Nov 3, 2026).
check("coverage: 1 staff confirmed, 2 not recorded (older program, older volunteer visit), 1 no staff", cov.staffConfirmedDays === 1 && cov.notRecordedDays === 2 && cov.noStaffDays === 1, cov);
check("coverage: the layers add up to activity-days", cov.staffConfirmedDays + cov.notRecordedDays + cov.noStaffDays === cov.activityDays);
check("coverage: facilities engaged includes the call", cov.facilitiesEngaged === 5, cov.facilitiesEngaged);
check("coverage: 1 staff visit confirmed, 2 not recorded", cov.staffVisitsConfirmed === 1 && cov.staffVisitsNotRecorded === 2);
const volNobodyWent = row({ interaction_type: "volunteer_visit", facility_id: "f-vol2", method: "in_person", lead_attended: false });
check("a volunteer visit recorded with nobody going = no staff there", facilityCoverage([volNobodyWent], noTeam).noStaffDays === 1);
const volOlder = row({ interaction_type: "volunteer_visit", facility_id: "f-vol3", method: "in_person" });
check("an older volunteer visit: staff not credited, not 'coordinated only', attendance not recorded", staffAttendance(volOlder, noTeam).confirmed.length === 0 && staffAttendance(volOlder, noTeam).unverified.length === 1 && !coordinatedOnly(volOlder, noTeam));

const sameDay = facilityCoverage(
  [row({ interaction_type: "resident_visit", method: "in_person" }), row({ interaction_type: "food_delivery", method: null })],
  noTeam
);
check("visit + older delivery by the same person, same day: 1 confirmed staff visit, 0 not recorded", sameDay.staffVisitsConfirmed === 1 && sameDay.staffVisitsNotRecorded === 0 && sameDay.staffConfirmedDays === 1);

// Q4: volunteer visit -- the arranger isn't credited; staff who went are.
const volWithStaff = row({ interaction_type: "volunteer_visit", staff_member_id: STAFF_A, method: "in_person", lead_attended: false });
const volTeam: TeamLinks = new Map([[volWithStaff.id, [STAFF_B]]]);
check("volunteer visit: staff who went credited, arranger not", JSON.stringify(staffAttendance(volWithStaff, volTeam).confirmed) === JSON.stringify([STAFF_B]));
check("... arranger is 'coordinated only'", coordinatedOnly(volWithStaff, volTeam));
check("... and the day is a staff-confirmed day", facilityCoverage([volWithStaff], volTeam).staffConfirmedDays === 1);
const volArrangerWent = row({ interaction_type: "volunteer_visit", staff_member_id: STAFF_A, method: "in_person", lead_attended: true });
check("volunteer visit where the arranger went too: arranger credited", staffAttendance(volArrangerWent, noTeam).confirmed.includes(STAFF_A) && !coordinatedOnly(volArrangerWent, noTeam));

// Q2 / D2: one volunteer, three residents, one facility, one day = 1 volunteer facility-day.
const v1 = row({ interaction_type: "volunteer_visit", method: "in_person" });
const v2 = row({ interaction_type: "volunteer_visit", method: "in_person" });
const v3 = row({ interaction_type: "volunteer_visit", method: "in_person" });
const vLinks = new Map([[v1.id, ["vol-1"]], [v2.id, ["vol-1"]], [v3.id, ["vol-1"]]]);
check("one volunteer visiting three residents = 1 volunteer facility-day", volunteerFacilityDayKeys([v1, v2, v3], vLinks).size === 1);

// A2 (Nov 3, 2026): volunteer outings. Saved together = one outing.
const outing = "55555555-5555-4555-8555-555555555555";
const o1 = row({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing });
const o2 = row({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing });
const o3 = row({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing });
const oLinks = new Map([[o1.id, ["vol-1"]], [o2.id, ["vol-1"]], [o3.id, ["vol-1"]]]);
check("one outing that saw three residents = 1 outing", volunteerOutingKeys([o1, o2, o3], oLinks).size === 1);
const secondTrip = row({ interaction_type: "volunteer_visit", method: "in_person", outing_id: "66666666-6666-4666-8666-666666666666" });
check("a second trip to the same facility the same day = a second outing", volunteerOutingKeys([o1, o2, o3, secondTrip], new Map([...oLinks, [secondTrip.id, ["vol-1"]]])).size === 2);
check("older entries: same volunteer, facility and day = 1 outing (never 3)", volunteerOutingKeys([v1, v2, v3], vLinks).size === 1);
check("older entries: a different volunteer the same day = another outing", volunteerOutingKeys([v1, v2], new Map([[v1.id, ["vol-1"]], [v2.id, ["vol-2"]]])).size === 2);

// Whole-page numbers (A2, A3, A5, A7, A8) through the same calculation the
// Impact page and export use.
const ctx = (over: Partial<Context> = {}): Context => ({
  engaged: new Map(),
  partners: new Set(),
  partnerTypes: new Map(),
  team: new Map(),
  volunteers: new Map(),
  volunteerNames: new Map(),
  volunteerRoles: new Map(),
  staffNames: new Map(),
  ...over,
});
const mrow = (r: Partial<MetricRow> & { interaction_type: string }): MetricRow =>
  ({ resident_id: null, people_reached: null, holiday: null, family_need: null, entered_by: null, ...row(r), ...r }) as MetricRow;
{
  const a = mrow({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing, resident_id: "res-1" });
  const b = mrow({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing, resident_id: "res-2" });
  const c = mrow({ interaction_type: "volunteer_visit", method: "in_person", outing_id: outing, resident_id: "res-3" });
  const v = computeImpactMetrics([a, b, c], ctx({ volunteers: new Map([[a.id, ["vol-1"]], [b.id, ["vol-1"]], [c.id, ["vol-1"]]]) })).values;
  check("outing with three residents: 1 outing, 3 engagements, 3 residents", v.volunteer_outings === 1 && v.resident_engagements === 3 && v.residents_served === 3, v);
  // Q4: a staff member who went along gets a staff visit; the residents still 3 engagements.
  const withStaff = computeImpactMetrics([a, b, c], ctx({ volunteers: new Map([[a.id, ["vol-1"]], [b.id, ["vol-1"]], [c.id, ["vol-1"]]]), team: new Map([[a.id, [STAFF_B]], [b.id, [STAFF_B]], [c.id, [STAFF_B]]]) })).values;
  check("... with a staff member who went: +1 staff visit, still 3 engagements, a staff day", withStaff.staff_visits_confirmed === 1 && withStaff.resident_engagements === 3 && withStaff.staff_confirmed_days === 1, withStaff);
  // A3: students are never community volunteers.
  const roles = ctx({ volunteers: new Map([[a.id, ["vol-1", "stu-1"]]]), volunteerRoles: new Map([["stu-1", "student"]]) });
  const r3 = computeImpactMetrics([a], roles).values;
  check("a student on a volunteer visit counts under School, not community volunteers", r3.volunteers_active === 1 && r3.student_volunteers === 1, r3);
  const prog = computeImpactMetrics([mrow({ interaction_type: "program", student_count: 20, chaperone_count: 2, volunteer_count: 3, lead_attended: true })], ctx()).values;
  check("program: students, chaperones and community volunteers kept apart", prog.students === 20 && prog.chaperones === 2 && prog.program_volunteers === 3 && prog.not_split === 0, prog);
  // A1: a resident at home, phone call, no facility: an engagement, no facility numbers.
  const home = computeImpactMetrics([mrow({ interaction_type: "resident_phone_call", facility_id: null, method: "phone", resident_id: "res-9" })], ctx()).values;
  check("call with a resident at home: 1 engagement, 0 facility numbers", home.resident_engagements === 1 && home.activity_days === 0 && home.facilities_engaged === 0, home);
  const visitHome = computeImpactMetrics([mrow({ interaction_type: "resident_visit", facility_id: null, method: "in_person_elsewhere", resident_id: "res-9" })], ctx()).values;
  check("visit at home (no facility): an engagement, never a facility visit", visitHome.staff_resident_visits === 1 && visitHome.activity_days === 0 && visitHome.staff_visits_confirmed === 0, visitHome);
  // A5: food with no count is "not recorded", never 0 people.
  const food = computeImpactMetrics(
    [mrow({ interaction_type: "food_delivery", people_reached: 12, lead_attended: true }), mrow({ interaction_type: "food_delivery", people_reached: null, lead_attended: true })],
    ctx()
  ).values;
  check("food: 2 deliveries, 12 people, 1 not recorded", food.deliveries === 2 && food.food_people === 12 && food.food_not_recorded === 1, food);
  // Food during a visit: one engagement, one delivery, one facility day.
  const both = computeImpactMetrics(
    [mrow({ interaction_type: "resident_visit", method: "in_person", resident_id: "res-1" }), mrow({ interaction_type: "food_delivery", people_reached: 1, resident_id: "res-1", lead_attended: true })],
    ctx()
  ).values;
  check("food during a visit: 1 engagement, 1 delivery, 1 facility visit-day, 1 staff visit", both.resident_engagements === 1 && both.deliveries === 1 && both.activity_days === 1 && both.staff_visits_confirmed === 1, both);
  // A7: staff appreciation. Two staff bring it: 1 activity, 2 staff visits, 1 facility day, 0 staff conversations.
  const app = mrow({ interaction_type: "staff_appreciation", method: "in_person", lead_attended: true });
  const appV = computeImpactMetrics([app], ctx({ team: new Map([[app.id, [STAFF_B]]]) })).values;
  check("appreciation by two staff: 1 activity, 1 facility, 2 staff visits, 1 facility-day, 0 staff interactions", appV.appreciation === 1 && appV.appreciation_facilities === 1 && appV.staff_visits_confirmed === 2 && appV.activity_days === 1 && appV.staff_interactions === 0 && appV.deliveries === 0, appV);
  // A8: referrals and rides shown apart, not engagements.
  const ref = computeImpactMetrics([mrow({ interaction_type: "medical_referral", resident_id: "res-1" }), mrow({ interaction_type: "ride_arranged", resident_id: "res-1" })], ctx()).values;
  check("referral and ride: shown apart, not resident engagements", ref.referrals === 1 && ref.rides === 1 && ref.resident_engagements === 0 && ref.residents_served === 0, ref);
}
check("Staff appreciation is under More types", MORE_TYPES.includes("staff_appreciation"));
check("A1: visits, volunteer visits, food and referrals can be saved without a facility when about a resident", ["resident_visit", "volunteer_visit", "food_delivery", "medical_referral"].every((t) => NO_FACILITY_RESIDENT_TYPES.includes(t)));

// Q7: school programs come from the partner's type.
check("program with a school partner is a school program", isSchoolProgram(row({ interaction_type: "program", partner_org_type: "school" })));
check("program with a Jewish organization is not", !isSchoolProgram(row({ interaction_type: "program", partner_org_type: "jewish_organization" })));
check("older 'School & shul' entry marked shul is not", !isSchoolProgram(row({ interaction_type: "school_engagement", program_partner: "shul" })));

// Q1 / D1 and D4 form options.
check("a phone call never needs a facility", FACILITY_OPTIONAL_TYPES.includes("resident_phone_call"));
check("programs and food ask who was there", ["program", "school_engagement", "food_delivery"].every((t) => ATTENDANCE_ASKED_TYPES.includes(t)));

// --- Entry card wording ----------------------------------------------------
check(
  "food card shows one number (people who got food), never items",
  serviceNumbersLine({ interaction_type: "food_delivery", people_reached: 8, participants: null }) === "8 people got food"
);
check(
  "program card shows students and volunteers",
  serviceNumbersLine({ interaction_type: "program", people_reached: 30, participants: null, student_count: 12, volunteer_count: 3 }) ===
    "12 students · 3 community volunteers · 30 residents reached"
);
check(
  "older program card says not split",
  serviceNumbersLine({ interaction_type: "school_engagement", people_reached: null, participants: 20 }) === "20 people took part (not split)"
);

// --- Form options --------------------------------------------------------
check("Facility visit is under More types", MORE_TYPES.includes("facility_visit"));
check("Family needs no facility", FACILITY_OPTIONAL_TYPES.includes("family_communication"));
check(
  "one record per person: staff, family, volunteer met, other -- not programs",
  ["facility_staff_communication", "family_communication", "volunteer_meeting", "other"].every((t) => ONE_PER_PERSON_TYPES.includes(t)) &&
    !ONE_PER_PERSON_TYPES.includes("program")
);

// --- Side panel "+ Log" is always blank (Oct 27, 2026 QA, decision A) ---
const C = "11111111-1111-4111-8111-111111111111";
const O = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const F = "44444444-4444-4444-8444-444444444444";
for (const path of [`/contacts/${C}`, `/organizations/${O}`, `/residents/${R}`, `/facilities/${F}`]) {
  const computer = logHref(path, false);
  const phone = logHref(path, true);
  check(`computer: + Log on ${path.split("/")[1]} page opens a blank form`, computer === `/interactions/new?back=${encodeURIComponent(path)}`, computer);
  check(`phone: + Log on ${path.split("/")[1]} page opens a blank note`, phone === "/quick-log", phone);
}
check("+ Log on a form page doesn't come back to the form", logHref("/interactions/new", false) === "/interactions/new");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
