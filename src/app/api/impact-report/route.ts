import { NextRequest, NextResponse } from "next/server";
import {
  getImpactBreakdown,
  getStaffActivity,
  getVolunteerImpact,
  type ImpactPeriod,
} from "@/lib/queries/impact";
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

  const [impact, staffActivity, volunteerImpact] = await Promise.all([
    getImpactBreakdown(period),
    getStaffActivity(period),
    getVolunteerImpact(period),
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
