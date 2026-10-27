/**
 * Offline check of the October 27 counting rules (no database): feeds
 * made-up entries through the same functions the Impact page and the
 * funder export use, and prints PASS/FAIL for each rule.
 * Run with: npx tsx scripts/check-report-rules.ts
 */
import {
  facilityPresence,
  groupCountsFor,
  partnerConversationsFor,
  staffInteractionFor,
  staffInteractions,
  staffVisits,
  type CountableRow,
  type EngagedLinks,
  type TeamLinks,
} from "../src/lib/queries/report-rules";
import { headCount, serviceNumbersLine, MORE_TYPES, FACILITY_OPTIONAL_TYPES, ONE_PER_PERSON_TYPES } from "../src/lib/domain/interaction";
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
check("new program: 12 students, 3 volunteers", JSON.stringify(groupCountsFor(newProgram)) === JSON.stringify({ students: 12, volunteers: 3, notSplit: 0 }));
const oldProgram = row({ interaction_type: "school_engagement", participants: 20 });
check("older program's single number is 'not split'", JSON.stringify(groupCountsFor(oldProgram)) === JSON.stringify({ students: 0, volunteers: 0, notSplit: 20 }));
const partOf = row({ interaction_type: "program", student_count: 5, part_of_id: newProgram.id });
check("an activity 'Part of' a project adds no head count", groupCountsFor(partOf).students === 0);
check("head count adds the three together", headCount({ participants: 2, student_count: 3, volunteer_count: 4 }) === 9);

// --- Entry card wording ----------------------------------------------------
check(
  "food card shows one number (people who got food), never items",
  serviceNumbersLine({ interaction_type: "food_delivery", people_reached: 8, participants: null }) === "8 people got food"
);
check(
  "program card shows students and volunteers",
  serviceNumbersLine({ interaction_type: "program", people_reached: 30, participants: null, student_count: 12, volunteer_count: 3 }) ===
    "12 students · 3 volunteers · 30 residents reached"
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

// --- "+ Log" from anyone's page keeps them --------------------------------
const C = "11111111-1111-4111-8111-111111111111";
const O = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const F = "44444444-4444-4444-8444-444444444444";
for (const quickLog of [false, true]) {
  const mode = quickLog ? "phone (Quick Log on)" : "computer";
  check(`${mode}: contact page -> form with that person`, logHref(`/contacts/${C}`, quickLog) === `/interactions/new?contact=${C}&back=%2Fcontacts%2F${C}`, logHref(`/contacts/${C}`, quickLog));
  check(`${mode}: partner page -> form with that partner`, logHref(`/organizations/${O}`, quickLog).startsWith(`/interactions/new?partner=${O}`));
  check(`${mode}: resident page -> form with that resident`, logHref(`/residents/${R}`, quickLog) === `/interactions/new?resident=${R}`);
  check(`${mode}: facility page keeps the facility`, logHref(`/facilities/${F}`, quickLog).includes(`facility=${F}`));
  check(`${mode}: contact's edit page isn't treated as their profile`, !logHref(`/contacts/${C}/edit`, quickLog).includes("contact="));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
