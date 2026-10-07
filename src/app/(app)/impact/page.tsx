import { getImpactOverview } from "@/lib/queries/impact-overview";
import { getStaffActivity, getVolunteerImpact, type ImpactPeriod } from "@/lib/queries/impact";
import { getImpactGrowth } from "@/lib/queries/impact-growth";
import { orgMonthStart } from "@/lib/format-date";
import { ImpactView } from "./impact-view";

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams;
  let period: ImpactPeriod = periodParam === "month" || periodParam === "all" ? periodParam : "quarter";

  // Opened plainly (no period chosen) early in a quarter with nothing
  // logged yet: show all time instead of a page of zeros, and say so.
  let fellBackToAllTime = false;
  if (!periodParam) {
    const q = await getImpactOverview("quarter");
    const h = q.headline;
    if (h.residentContacts + h.familyConversations + h.staffTouchpoints + h.programs + h.deliveries === 0) {
      period = "all";
      fellBackToAllTime = true;
    }
  }

  // First day of the period (Cleveland calendar), so tapping a staff
  // member opens their interactions for the same period.
  const { year, month } = orgMonthStart();
  const firstMonth = period === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const periodFrom = period === "all" ? null : `${year}-${String(firstMonth).padStart(2, "0")}-01`;

  const [o, staff, volunteers, growth] = await Promise.all([
    getImpactOverview(period),
    getStaffActivity(period),
    getVolunteerImpact(period),
    getImpactGrowth(),
  ]);
  return <ImpactView period={period} o={o} growth={growth} team={{ staff, volunteers, periodFrom }} fellBackToAllTime={fellBackToAllTime} />;
}
