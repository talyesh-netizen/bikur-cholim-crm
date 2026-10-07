import { createClient } from "@/lib/supabase/server";
import { orgMonthKey, orgMonthStart } from "@/lib/format-date";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import { pad2, selectAllPages } from "@/lib/queries/impact";
import type { MonthBar } from "@/lib/queries/impact-overview";

/**
 * Growth over time for the Impact page. "New" means the first time the
 * CRM shows us working with someone -- their first logged interaction --
 * not the day their record was added, because most records were added
 * all at once when the old tracking sheet was imported (Sept 2026).
 */
export type ImpactGrowth = {
  /** One bar per quarter, oldest first. */
  newResidents: MonthBar[];
  newFacilities: MonthBar[];
  newVolunteers: MonthBar[];
  /** Month by month: % of residents we'd met by then who had a family
   * connection (a family conversation logged, or a family contact on file). */
  familyConnection: { label: string; percent: number; connected: number; known: number }[];
};

const quarterKey = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
};
const quarterLabel = (key: string) => {
  const [y, q] = key.split("-Q");
  return `Q${q} '${y.slice(2)}`;
};

export async function getImpactGrowth(): Promise<ImpactGrowth> {
  const supabase = await createClient();
  const [rows, volunteerTags, links, residents] = await Promise.all([
    selectAllPages<{ interaction_type: string; occurred_at: string; resident_id: string | null; contact_id: string | null; facility_id: string | null }>(
      (from, to) =>
        supabase.from("interactions").select("interaction_type, occurred_at, resident_id, contact_id, facility_id").order("id").range(from, to)
    ),
    selectAllPages<{ contact_id: string; interactions: { occurred_at: string } | { occurred_at: string }[] | null }>((from, to) =>
      supabase.from("interaction_volunteers").select("contact_id, interactions(occurred_at)").order("interaction_id").order("contact_id").range(from, to)
    ),
    selectAllPages<{ resident_id: string; created_at: string }>((from, to) =>
      supabase.from("resident_contacts").select("resident_id, created_at").eq("active", true).order("id").range(from, to)
    ),
    selectAllPages<{ id: string; status: string }>((from, to) =>
      supabase.from("resident_summary").select("id, status").order("id").range(from, to)
    ),
  ]);

  // Earliest moment for each key.
  const firstOf = (pairs: [string | null, string][]) => {
    const first = new Map<string, string>();
    for (const [key, at] of pairs) {
      if (key && (!first.has(key) || at < first.get(key)!)) first.set(key, at);
    }
    return first;
  };
  const firstResident = firstOf(rows.map((r) => [r.resident_id, r.occurred_at]));
  const firstFacility = firstOf(rows.map((r) => [r.facility_id, r.occurred_at]));
  const firstVolunteer = firstOf([
    ...volunteerTags.flatMap((v) => {
      const i = Array.isArray(v.interactions) ? v.interactions[0] : v.interactions;
      return i ? [[v.contact_id, i.occurred_at] as [string, string]] : [];
    }),
    ...rows.filter((r) => r.interaction_type === "volunteer_meeting").map((r) => [r.contact_id, r.occurred_at] as [string | null, string]),
  ]);
  const familySince = firstOf([
    ...rows.filter((r) => r.interaction_type === "family_communication").map((r) => [r.resident_id, r.occurred_at] as [string | null, string]),
    ...links.map((l) => [l.resident_id, l.created_at] as [string, string]),
  ]);

  // Quarters from the first one with any work up to the current one.
  const { year, month } = orgMonthStart();
  const current = quarterKey(`${year}-${pad2(month)}`);
  const all = [...firstResident.values(), ...firstFacility.values()].map(orgMonthKey).sort();
  const quarters: string[] = [];
  if (all.length) {
    let [qy, qq] = quarterKey(all[0]).split("-Q").map(Number);
    for (;;) {
      const key = `${qy}-Q${qq}`;
      quarters.push(key);
      if (key === current || quarters.length > 40) break;
      qq += 1;
      if (qq > 4) [qy, qq] = [qy + 1, 1];
    }
  }
  const perQuarter = (first: Map<string, string>): MonthBar[] => {
    const counts = new Map<string, number>();
    for (const at of first.values()) {
      const q = quarterKey(orgMonthKey(at));
      counts.set(q, (counts.get(q) ?? 0) + 1);
    }
    return quarters.map((q) => ({ label: quarterLabel(q), values: [counts.get(q) ?? 0] }));
  };

  // Family connection, month by month (last 12 months), among residents
  // still active today.
  const active = new Set(residents.filter((r) => (ACTIVE_RESIDENT_STATUSES as string[]).includes(r.status)).map((r) => r.id));
  const familyConnection: ImpactGrowth["familyConnection"] = [];
  for (let i = 11; i >= 0; i--) {
    const { year: y, month: m } = orgMonthStart(i);
    const key = `${y}-${pad2(m)}`;
    let known = 0;
    let connected = 0;
    for (const [id, at] of firstResident) {
      if (!active.has(id) || orgMonthKey(at) > key) continue;
      known += 1;
      const since = familySince.get(id);
      if (since && orgMonthKey(since) <= key) connected += 1;
    }
    if (known === 0) continue;
    familyConnection.push({
      label: new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      percent: Math.round((connected / known) * 100),
      connected,
      known,
    });
  }

  return {
    newResidents: perQuarter(firstResident),
    newFacilities: perQuarter(firstFacility),
    newVolunteers: perQuarter(firstVolunteer),
    familyConnection,
  };
}
