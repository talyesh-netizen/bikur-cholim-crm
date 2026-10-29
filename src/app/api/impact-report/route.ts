import { NextRequest, NextResponse } from "next/server";
import {
  getImpactBreakdown,
  getStaffActivity,
  getVolunteerImpact,
  getServicesDelivered,
} from "@/lib/queries/impact";
import { getImpactOverview } from "@/lib/queries/impact-overview";
import { currentMonth, parsePeriod } from "@/lib/report-period";
import { labelFor, UNMET_NEED_REASONS } from "@/lib/domain/interaction";
import { ORGANIZATION_NAME, APP_NAME, ORGANIZATION_TIMEZONE } from "@/lib/config";
import { getLocalToday } from "@/lib/format-date";
import { csvRow } from "@/lib/csv";
import { getFacility } from "@/lib/queries/facilities";

/**
 * A funder/board-ready export of the same aggregate numbers already
 * shown on the dashboard's Impact card -- nothing beyond that: no
 * resident names, no interaction notes, no other identifying detail.
 * See PRIVACY_AND_SECURITY.md / ROADMAP.md on what may leave the app.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  // Any month, quarter, year or dates (director, Oct 21, 2026).
  const period = parsePeriod({ period: q.get("period"), from: q.get("from"), to: q.get("to") }, currentMonth);
  // Optional: the same report for one facility (from its profile page).
  const facilityId = request.nextUrl.searchParams.get("facility") || undefined;
  const facility = facilityId ? await getFacility(facilityId) : null;
  if (facilityId && !facility) {
    return new NextResponse("Facility not found, or you don't have access to it.", { status: 404 });
  }

  const [impact, staffActivity, volunteerImpact, services, overview] = await Promise.all([
    getImpactBreakdown(period, facilityId),
    getStaffActivity(period, facilityId),
    getVolunteerImpact(period, facilityId),
    getServicesDelivered(period, facilityId),
    // The organization-wide facility and staff numbers (not per facility).
    facilityId ? Promise.resolve(null) : getImpactOverview(period),
  ]);

  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ORGANIZATION_TIMEZONE,
  });

  let csv = "";
  csv += csvRow([`${ORGANIZATION_NAME} — ${APP_NAME}`]);
  csv += csvRow([`Impact report — ${facility ? `${facility.name} — ` : ""}${period.label}`]);
  csv += csvRow([`Generated ${generatedAt}`]);
  csv += csvRow([]);

  if (overview) {
    const h = overview.headline;
    csv += csvRow(["Facility visits"]);
    csv += csvRow(["Measure", "What it counts", "Count"]);
    csv += csvRow(["Facility visit-days (staff)", "Days our staff were at a facility, each facility once a day", h.visitDays]);
    csv += csvRow(["Staff visits", "Each staff member once per facility per day they were there", h.staffVisits]);
    csv += csvRow(["Volunteer-only visits", "Days only volunteers were at a facility", h.volunteerOnlyDays]);
    csv += csvRow(["Total facility presence", "Staff, volunteers or both, each facility once a day", h.presenceDays]);
    csv += csvRow(["Facilities visited", "Different facilities we were at", h.facilitiesVisited]);
    csv += csvRow(["Facilities engaged", "Different facilities with any contact, calls included", h.facilitiesEngaged]);
    csv += csvRow(["Facility staff interactions", "Each staff person spoken with, once per conversation", h.staffTouchpoints]);
    csv += csvRow(["Facility staff met", "Different staff people", h.staffPeople]);
    csv += csvRow(["Partner conversations", "Schools, shuls, hospices, agencies and other partners; each person once per conversation", h.partnerConversations]);
    csv += csvRow(["Partners spoken with", "Different partner people", h.partnerPeople]);
    csv += csvRow([]);
  }

  const { food, volunteers, schoolShul, unmetNeed, peopleReached } = services;
  csv += csvRow(["Services delivered"]);
  csv += csvRow(["Service", "Measure", "Count"]);
  csv += csvRow(["Residents served one-on-one", "Different residents (each counted once)", services.oneOnOne.residents]);
  csv += csvRow(["Residents served one-on-one", "Visits & calls (staff and volunteers)", services.oneOnOne.contacts]);
  csv += csvRow(["Reached through programs & deliveries", "Total attendance (approx.; people may be counted more than once)", peopleReached.total]);
  csv += csvRow(["Reached through programs & deliveries", "Facility programs", peopleReached.programs]);
  csv += csvRow(["Reached through programs & deliveries", "Food & holiday deliveries", peopleReached.food]);
  csv += csvRow(["Reached through programs & deliveries", "Volunteer group visits", peopleReached.volunteerGroups]);
  csv += csvRow(["Reached through programs & deliveries", "Group resident visits", peopleReached.residentGroups]);
  csv += csvRow(["Reached through programs & deliveries", "School & shul programs", peopleReached.schoolShul]);
  csv += csvRow(["Reached through programs & deliveries", "Other activities", peopleReached.other]);
  csv += csvRow(["Food deliveries", "Deliveries", food.deliveries]);
  csv += csvRow(["Food deliveries", "People who received food (approx.)", food.peopleReached]);
  csv += csvRow(["Food deliveries", "Shabbos deliveries", food.byOccasion.shabbos]);
  csv += csvRow(["Food deliveries", "Yom Tov deliveries", food.byOccasion.yomTov]);
  csv += csvRow(["Volunteer impact", "Volunteer visits", volunteers.visits]);
  csv += csvRow(["Volunteer impact", "Volunteers", volunteers.volunteers]);
  csv += csvRow(["Volunteer impact", "Volunteer hours", volunteers.hours]);
  csv += csvRow(["Volunteer impact", "Residents visited", volunteers.residentsVisited]);
  csv += csvRow(["School & shul programs", "Programs", schoolShul.programs]);
  csv += csvRow(["School & shul programs", "School programs", schoolShul.school]);
  csv += csvRow(["School & shul programs", "Shul programs", schoolShul.shul]);
  csv += csvRow(["School & shul programs", "Residents reached (approx.)", schoolShul.peopleReached]);
  // Students and volunteers are counted here only, for every program
  // (director, Oct 28, 2026), not again under School & shul.
  csv += csvRow(["Program participation", "Programs with a head count (each group counted once, however many facilities)", services.groupVolunteers.projects]);
  csv += csvRow(["Program participation", "Students", services.groupVolunteers.students]);
  csv += csvRow(["Program participation", "Volunteers", services.groupVolunteers.volunteers]);
  csv += csvRow(["Program participation", "Not split (older entries: students and volunteers together)", services.groupVolunteers.notSplit]);
  csv += csvRow(["Medical referrals", "Referred to Bikur Cholim medical referrals", services.medicalReferrals]);
  csv += csvRow(["Rides", "Rides arranged through Bikur Cholim", services.rides]);
  csv += csvRow(["Staff time", "Staff hours logged", services.staffHours]);
  csv += csvRow([]);

  csv += csvRow(["Need we couldn't meet"]);
  csv += csvRow(["Reason", "Requests"]);
  if (unmetNeed.total === 0) {
    csv += csvRow(["None recorded in this period."]);
  }
  for (const r of unmetNeed.byReason) {
    csv += csvRow([r.reason === "unspecified" ? "Reason not given" : labelFor(UNMET_NEED_REASONS, r.reason), r.count]);
  }
  if (unmetNeed.total > 0) csv += csvRow(["Total", unmetNeed.total]);
  csv += csvRow([]);

  csv += csvRow(["Interactions by type"]);
  csv += csvRow(["Category", "Count"]);
  for (const bucket of impact.buckets) {
    csv += csvRow([bucket.label, bucket.count]);
  }
  csv += csvRow(["Total", impact.total]);
  csv += csvRow([]);

  csv += csvRow(["Staff impact"]);
  csv += csvRow(["Staff member", "Interactions logged"]);
  if (staffActivity.length === 0) {
    csv += csvRow(["No interactions logged in this period yet."]);
  }
  for (const row of staffActivity) {
    csv += csvRow([row.name, row.count]);
  }
  csv += csvRow([]);

  csv += csvRow(["Volunteer impact"]);
  csv += csvRow(["Volunteer", "Visits"]);
  if (volunteerImpact.length === 0) {
    csv += csvRow(["No volunteer visits logged in this period yet."]);
  }
  for (const row of volunteerImpact) {
    csv += csvRow([row.name, row.count]);
  }

  const facilitySlug = facility ? `${facility.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-` : "";
  const filename = `impact-report-${facilitySlug}${period.key.replace(/\.\./g, "_to_")}-${getLocalToday()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
