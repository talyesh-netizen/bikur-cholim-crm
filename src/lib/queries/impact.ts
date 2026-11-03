import { createClient } from "@/lib/supabase/server";
import type { InteractionType } from "@/lib/domain/interaction";
import { orgDayStartIso, orgMonthStart, orgMonthKey } from "@/lib/format-date";
import { periodBounds, type ReportPeriod } from "@/lib/report-period";

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The period a report covers: any month, quarter, year or range of
 * days (see lib/report-period.ts). */
export type ImpactPeriod = ReportPeriod;

export type ImpactBucket = {
  key: string;
  label: string;
  color: string;
  count: number;
};

// Every interaction_type maps to exactly one bucket. Order here is the
// fixed categorical order the donut renders in — see the dataviz
// skill's palette.md: color identity follows the entity, in a fixed
// order, never reassigned when a filter changes which buckets are
// non-zero.
const BUCKET_DEFS: { key: string; label: string; color: string; types: InteractionType[] }[] = [
  { key: "resident_visits", label: "Resident visits & calls", color: "#2a78d6", types: ["resident_visit", "resident_phone_call"] },
  { key: "facility_staff", label: "Facility & staff", color: "#eb6834", types: ["facility_staff_communication", "facility_visit", "facility_discovery_visit"] },
  { key: "programs", label: "Programs (facility, school & shul)", color: "#1baf7a", types: ["program", "school_engagement"] },
  { key: "volunteers", label: "Volunteers (visits & meetings)", color: "#e34948", types: ["volunteer_visit", "volunteer_meeting"] },
  { key: "food", label: "Food", color: "#eda100", types: ["food_delivery", "kosher_food_coordination"] },
  { key: "family", label: "Families", color: "#e87ba4", types: ["family_communication", "care_navigation"] },
  { key: "referrals", label: "Referrals & rides", color: "#008300", types: ["medical_referral", "ride_arranged", "referral", "hospital_related_communication"] },
  { key: "other", label: "Other", color: "#4a3aa7", types: ["email", "other"] },
];

// PostgREST caps every response at 1,000 rows by default, so a plain
// select over a year+ of interactions silently comes back short --
// every impact number here pages through the whole period instead.
const PAGE_SIZE = 1000;

export async function selectAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

/** Where a period starts and ends, as exact moments ([start, end)). */
export function periodStart(period: ImpactPeriod): string | null {
  return periodBounds(period).start;
}

export async function getImpactBreakdown(period: ImpactPeriod, facilityId?: string): Promise<{
  buckets: ImpactBucket[];
  total: number;
}> {
  const supabase = await createClient();
  const bounds = periodBounds(period);
  const { start, end } = bounds;

  const data = await selectAllPages<{ interaction_type: string }>((from, to) => {
    // Each activity once: entries reviewed as a copy of another are skipped.
    let query = supabase.from("interactions").select("interaction_type").is("counted_in_id", null).is("voided_at", null).order("id").range(from, to);
    if (start) query = query.gte("occurred_at", start);
    if (end) query = query.lt("occurred_at", end);
    if (facilityId) query = query.eq("facility_id", facilityId);
    return query;
  });

  const counts = new Map<string, number>();
  for (const row of data) {
    const type = row.interaction_type as string;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const buckets = BUCKET_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    color: def.color,
    count: def.types.reduce((sum, t) => sum + (counts.get(t) ?? 0), 0),
  }));

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  return { buckets, total };
}

export type MonthlyCount = { key: string; label: string; count: number };

/** Total interactions logged per month, most recent `months` months
 * (oldest first) -- a simple trend line for showing growth over time,
 * separate from the type/staff/volunteer breakdowns above. */
export async function getInteractionTrend(months = 6): Promise<MonthlyCount[]> {
  const supabase = await createClient();
  const first = orgMonthStart(months - 1);
  const start = orgDayStartIso(`${first.year}-${pad2(first.month)}-01`)!;

  const data = await selectAllPages<{ occurred_at: string }>((from, to) =>
    supabase.from("interactions").select("occurred_at").is("counted_in_id", null).is("voided_at", null).gte("occurred_at", start).order("id").range(from, to)
  );

  // Months are Cleveland months, so a visit on the evening of the 31st
  // lands in its own month rather than the next one.
  const buckets: MonthlyCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const { year, month } = orgMonthStart(i);
    buckets.push({
      key: `${year}-${pad2(month)}`,
      label: new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      count: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  for (const row of data) {
    const key = orgMonthKey(row.occurred_at);
    const idx = indexByKey.get(key);
    if (idx !== undefined) buckets[idx].count += 1;
  }

  return buckets;
}
