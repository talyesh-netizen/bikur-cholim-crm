import { getImpactOverview } from "@/lib/queries/impact-overview";
import { getStaffActivity, getVolunteerImpact } from "@/lib/queries/impact";
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
  if (!params.period && !params.from) {
    const q = await getImpactOverview(currentQuarter());
    const h = q.headline;
    if (h.residentContacts + h.familyConversations + h.staffTouchpoints + h.programs + h.deliveries === 0) {
      period = ALL_TIME;
      fellBackToAllTime = true;
    }
  }

  const [o, staff, volunteers, growth] = await Promise.all([
    getImpactOverview(period),
    getStaffActivity(period),
    getVolunteerImpact(period),
    getImpactGrowth(),
  ]);
  return (
    <ImpactView
      period={period}
      choices={periodChoices()}
      o={o}
      growth={growth}
      team={{ staff, volunteers }}
      fellBackToAllTime={fellBackToAllTime}
    />
  );
}
