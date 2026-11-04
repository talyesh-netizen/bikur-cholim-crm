import { getImpactPage } from "@/lib/queries/impact-metrics";
import { getImpactGrowth } from "@/lib/queries/impact-growth";
import { ALL_TIME, currentQuarter, parsePeriod, periodChoices } from "@/lib/report-period";
import { ImpactView } from "./impact-view";

export default async function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  // Any month, quarter, year or range of days (director, Oct 21, 2026).
  let period = parsePeriod(params);

  // Opened plainly (no period chosen) early in a quarter with nothing
  // logged yet: show all time instead of a page of zeros, and say so.
  let fellBackToAllTime = false;
  let data = await getImpactPage(period);
  if (!params.period && !params.from && data.metrics.rows.length === 0 && period.key === currentQuarter().key) {
    period = ALL_TIME;
    fellBackToAllTime = true;
    data = await getImpactPage(period);
  }

  const growth = await getImpactGrowth();
  return <ImpactView period={period} choices={periodChoices()} data={data} growth={growth} fellBackToAllTime={fellBackToAllTime} />;
}
