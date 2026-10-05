import { NextRequest, NextResponse } from "next/server";
import { getImpactByGroup, type ImpactPeriod } from "@/lib/queries/impact";
import { ORGANIZATION_NAME, APP_NAME, ORGANIZATION_TIMEZONE } from "@/lib/config";
import { getLocalToday } from "@/lib/format-date";
import { csvRow } from "@/lib/csv";

const PERIOD_LABELS: Record<ImpactPeriod, string> = {
  month: "This month",
  quarter: "This quarter",
  all: "All time",
};

/** Funder-ready CSV of the dashboard's "Impact by healthcare group"
 * table. Aggregate numbers only -- no resident names or notes (see
 * PRIVACY_AND_SECURITY.md). Reads with the signed-in person's own
 * access, like the main impact report. */
export async function GET(request: NextRequest) {
  const periodParam = request.nextUrl.searchParams.get("period");
  const period: ImpactPeriod = periodParam === "month" || periodParam === "all" ? periodParam : "quarter";

  const { rows, notAtAFacility } = await getImpactByGroup(period);
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ORGANIZATION_TIMEZONE,
  });

  let csv = "";
  csv += csvRow([`${ORGANIZATION_NAME} — ${APP_NAME}`]);
  csv += csvRow([`Impact by healthcare group — ${PERIOD_LABELS[period]}`]);
  csv += csvRow([`Generated ${generatedAt}`]);
  csv += csvRow([]);
  csv += csvRow([
    "Healthcare group",
    "Facilities",
    "Residents now",
    "Residents reached",
    "Visits & calls",
    "Programs",
    "Food",
    "Referrals & rides",
    "All interactions",
  ]);
  for (const r of rows) {
    csv += csvRow([r.group, r.facilities, r.currentResidents, r.residentsReached, r.visits, r.programs, r.food, r.referrals, r.total]);
  }
  csv += csvRow([]);
  csv += csvRow([`Interactions not tied to a facility (not counted above): ${notAtAFacility}`]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="impact-by-group-${period}-${getLocalToday()}.csv"`,
    },
  });
}
