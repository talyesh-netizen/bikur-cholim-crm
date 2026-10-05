import { getImpactOverview } from "@/lib/queries/impact-overview";
import type { ImpactPeriod } from "@/lib/queries/impact";
import { ImpactView } from "./impact-view";

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams;
  const period: ImpactPeriod = periodParam === "month" || periodParam === "all" ? periodParam : "quarter";
  return <ImpactView period={period} o={await getImpactOverview(period)} />;
}
