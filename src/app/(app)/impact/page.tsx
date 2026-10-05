import { getImpactOverview } from "@/lib/queries/impact-overview";
import { getStaffActivity, getVolunteerImpact, type ImpactPeriod } from "@/lib/queries/impact";
import { orgMonthStart } from "@/lib/format-date";
import { ImpactView } from "./impact-view";

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams;
  const period: ImpactPeriod = periodParam === "month" || periodParam === "all" ? periodParam : "quarter";

  // First day of the period (Cleveland calendar), so tapping a staff
  // member opens their interactions for the same period.
  const { year, month } = orgMonthStart();
  const firstMonth = period === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const periodFrom = period === "all" ? null : `${year}-${String(firstMonth).padStart(2, "0")}-01`;

  const [o, staff, volunteers] = await Promise.all([
    getImpactOverview(period),
    getStaffActivity(period),
    getVolunteerImpact(period),
  ]);
  return <ImpactView period={period} o={o} team={{ staff, volunteers, periodFrom }} />;
}
