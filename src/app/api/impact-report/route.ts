import { NextRequest, NextResponse } from "next/server";
import {
  getImpactBreakdown,
  getStaffActivity,
  getVolunteerImpact,
  getServicesDelivered,
  type ImpactPeriod,
} from "@/lib/queries/impact";
import { labelFor, UNMET_NEED_REASONS } from "@/lib/domain/interaction";
import { ORGANIZATION_NAME, APP_NAME } from "@/lib/config";

const PERIOD_LABELS: Record<ImpactPeriod, string> = {
  month: "This month",
  quarter: "This quarter",
  all: "All time",
};

/** Wraps a value in quotes (doubling any inner quotes) only when it
 * actually needs it -- commas, quotes, or newlines -- so the common
 * case stays plain and readable if opened in a text editor. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: (string | number)[]): string {
  return values.map(csvField).join(",") + "\r\n";
}

/**
 * A funder/board-ready export of the same aggregate numbers already
 * shown on the dashboard's Impact card -- nothing beyond that: no
 * resident names, no interaction notes, no other identifying detail.
 * See PRIVACY_AND_SECURITY.md / ROADMAP.md on what may leave the app.
 */
export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period");
  const period: ImpactPeriod = periodParam === "quarter" || periodParam === "all" ? periodParam : "month";

  const [impact, staffActivity, volunteerImpact, services] = await Promise.all([
    getImpactBreakdown(period),
    getStaffActivity(period),
    getVolunteerImpact(period),
    getServicesDelivered(period),
  ]);

  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  let csv = "";
  csv += csvRow([`${ORGANIZATION_NAME} — ${APP_NAME}`]);
  csv += csvRow([`Impact report — ${PERIOD_LABELS[period]}`]);
  csv += csvRow([`Generated ${generatedAt}`]);
  csv += csvRow([]);

  const { food, volunteers, schoolShul, careNavigation, unmetNeed } = services;
  csv += csvRow(["Services delivered"]);
  csv += csvRow(["Service", "Measure", "Count"]);
  csv += csvRow(["Food deliveries", "Deliveries", food.deliveries]);
  csv += csvRow(["Food deliveries", "Items delivered", food.items]);
  csv += csvRow(["Food deliveries", "Residents reached (approx.)", food.peopleReached]);
  csv += csvRow(["Food deliveries", "Shabbos deliveries", food.byOccasion.shabbos]);
  csv += csvRow(["Food deliveries", "Yom Tov deliveries", food.byOccasion.yomTov]);
  csv += csvRow(["Volunteer impact", "Volunteer visits", volunteers.visits]);
  csv += csvRow(["Volunteer impact", "Volunteers", volunteers.volunteers]);
  csv += csvRow(["Volunteer impact", "Volunteer hours", volunteers.hours]);
  csv += csvRow(["Volunteer impact", "Residents visited", volunteers.residentsVisited]);
  csv += csvRow(["School & shul programs", "Programs", schoolShul.programs]);
  csv += csvRow(["School & shul programs", "School programs", schoolShul.school]);
  csv += csvRow(["School & shul programs", "Shul programs", schoolShul.shul]);
  csv += csvRow(["School & shul programs", "Students / members who took part", schoolShul.participants]);
  csv += csvRow(["School & shul programs", "Residents reached (approx.)", schoolShul.peopleReached]);
  csv += csvRow(["Medical referrals", "Referred to Bikur Cholim medical referrals", services.medicalReferrals]);
  csv += csvRow(["Rides", "Rides arranged through Bikur Cholim", services.rides]);
  csv += csvRow(["Care navigation", "Families helped", careNavigation.families]);
  csv += csvRow(["Care navigation", "Hours spent", careNavigation.hours]);
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

  const filename = `impact-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
