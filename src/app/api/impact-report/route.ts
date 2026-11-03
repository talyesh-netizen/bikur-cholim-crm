import { NextRequest, NextResponse } from "next/server";
import { getImpactBreakdown } from "@/lib/queries/impact";
import { getImpactMetrics, METRICS, SECTIONS } from "@/lib/queries/impact-metrics";
import { currentMonth, parsePeriod } from "@/lib/report-period";
import { ORGANIZATION_NAME, APP_NAME, ORGANIZATION_TIMEZONE } from "@/lib/config";
import { getLocalToday } from "@/lib/format-date";
import { csvRow } from "@/lib/csv";
import { getFacility } from "@/lib/queries/facilities";

/**
 * A funder/board-ready export of the same numbers the Impact page shows
 * -- nothing beyond that: no resident names, no interaction notes, no
 * other identifying detail. See PRIVACY_AND_SECURITY.md / ROADMAP.md on
 * what may leave the app.
 *
 * Final cleanup batch (Nov 3, 2026): the same eight sections as the Impact
 * page, never added together (Q7). Staff hours, volunteer hours and unmet
 * need are no longer asked and are left out (C3; the data stays on file);
 * funder stories live in Stories.
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

  const [impact, metrics] = await Promise.all([getImpactBreakdown(period, facilityId), getImpactMetrics(period, facilityId)]);
  const v = metrics.values;

  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ORGANIZATION_TIMEZONE,
  });

  let csv = "";
  csv += csvRow([`${ORGANIZATION_NAME} — ${APP_NAME}`]);
  csv += csvRow([`Impact report — ${facility ? `${facility.name} — ` : ""}${period.label}`]);
  csv += csvRow([`Generated ${generatedAt}`]);
  csv += csvRow(["Numbers in different sections are never added together. \"(approx.)\" = a typed-in head count; the same person can be counted more than once."]);
  csv += csvRow([]);

  for (const section of SECTIONS) {
    csv += csvRow([section.title]);
    csv += csvRow(["Measure", "What it counts", "Count"]);
    for (const m of METRICS.filter((x) => x.section === section.key)) {
      csv += csvRow([m.approx ? `${m.label} (approx.)` : m.label, m.full, v[m.key] ?? 0]);
    }
    if (section.key === "programs") {
      csv += csvRow(["Programs at facilities", "Programs held at a facility", v.programs_at_facility]);
      csv += csvRow(["Programs elsewhere", "Programs held somewhere else (a school, a shul)", v.programs_elsewhere]);
    }
    if (section.key === "school" && v.schools_not_named > 0) {
      csv += csvRow(["School programs with no school named", "Older entries without a school filed as the partner", v.schools_not_named]);
    }
    if (section.key === "family") {
      for (const need of metrics.familyNeeds) csv += csvRow([`What families needed: ${need.label}`, "Entries where it was picked", need.value]);
    }
    if (section.key === "professional") {
      for (const t of metrics.partnersByType) csv += csvRow([`Partners spoken with: ${t.label}`, "Different partner people, by how they're filed", t.value]);
    }
    csv += csvRow([]);
  }

  csv += csvRow(["Interactions by type"]);
  csv += csvRow(["Category", "Count"]);
  for (const bucket of impact.buckets) {
    csv += csvRow([bucket.label, bucket.count]);
  }
  csv += csvRow(["Total", impact.total]);
  csv += csvRow([]);

  csv += csvRow(["Staff"]);
  csv += csvRow(["Staff member", "Staff visits (confirmed)", "Staff visits not recorded", "Activities", "Coordinated only"]);
  if (metrics.staff.length === 0) csv += csvRow(["No interactions logged in this period yet."]);
  for (const r of metrics.staff) csv += csvRow([r.name, r.staffVisits, r.notRecorded, r.activities, r.coordinatedOnly]);
  csv += csvRow([]);

  csv += csvRow(["Volunteers"]);
  csv += csvRow(["Volunteer", "Facility-days", "Residents visited", "Volunteer visits"]);
  if (metrics.volunteers.length === 0) csv += csvRow(["No volunteer visits logged in this period yet."]);
  for (const r of metrics.volunteers) csv += csvRow([r.name, r.facilityDays, r.residents, r.visits]);

  const facilitySlug = facility ? `${facility.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-` : "";
  const filename = `impact-report-${facilitySlug}${period.key.replace(/\.\./g, "_to_")}-${getLocalToday()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
