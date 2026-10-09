/** On-site mode's tabs (decided Oct 9, 2026). */
export type OnsiteTab = "residents" | "staff" | "today";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The on-site page for a facility, on a given tab (and with one
 * resident opened) -- where a form started on site goes back to, so a
 * round of visits never leaves on-site mode. Undefined unless the ids
 * are real ids, so a link can't point anywhere else. */
export function onsiteHref(facilityId: string | null | undefined, tab?: OnsiteTab, residentId?: string | null): string | undefined {
  if (!facilityId || !ID.test(facilityId)) return undefined;
  const params = new URLSearchParams();
  if (tab && tab !== "residents") params.set("tab", tab);
  if (residentId && ID.test(residentId)) params.set("open", residentId);
  const query = params.toString();
  return `/facilities/${facilityId}/onsite${query ? `?${query}` : ""}`;
}
