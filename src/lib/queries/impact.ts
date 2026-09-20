import { createClient } from "@/lib/supabase/server";
import type { InteractionType } from "@/lib/domain/interaction";

export type ImpactPeriod = "month" | "quarter" | "all";

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
  { key: "resident_visits", label: "Resident visits", color: "#2a78d6", types: ["resident_visit", "resident_phone_call", "volunteer_visit"] },
  { key: "facility_staff", label: "Facility & staff", color: "#eb6834", types: ["facility_staff_communication", "facility_discovery_visit"] },
  { key: "programs", label: "Programs & events", color: "#1baf7a", types: ["program"] },
  { key: "school", label: "School engagement", color: "#e34948", types: ["school_engagement"] },
  { key: "kosher_food", label: "Kosher food", color: "#eda100", types: ["kosher_food_coordination"] },
  { key: "family", label: "Family contact", color: "#e87ba4", types: ["family_communication"] },
  { key: "referrals", label: "Referrals", color: "#008300", types: ["referral"] },
  { key: "other", label: "Other", color: "#4a3aa7", types: ["hospital_related_communication", "email", "other"] },
];

function periodStart(period: ImpactPeriod): string | null {
  const now = new Date();
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterStartMonth, 1).toISOString();
  }
  return null;
}

export async function getImpactBreakdown(period: ImpactPeriod = "month"): Promise<{
  buckets: ImpactBucket[];
  total: number;
}> {
  const supabase = await createClient();
  const start = periodStart(period);

  let query = supabase.from("interactions").select("interaction_type");
  if (start) {
    query = query.gte("occurred_at", start);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
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

export type PersonImpactRow = { id: string; name: string; count: number };

/** How many interactions each staff member logged in the period — lets
 * the director show funders (and staff themselves) impact beyond just
 * their own work, not just a single org-wide total. */
export async function getStaffActivity(period: ImpactPeriod = "month"): Promise<PersonImpactRow[]> {
  const supabase = await createClient();
  const start = periodStart(period);

  let query = supabase.from("interactions").select("staff_member_id, profiles(full_name)");
  if (start) query = query.gte("occurred_at", start);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const counts = new Map<string, PersonImpactRow>();
  for (const row of data ?? []) {
    const r = row as unknown as { staff_member_id: string; profiles: { full_name: string } | null };
    const existing = counts.get(r.staff_member_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.staff_member_id, {
        id: r.staff_member_id,
        name: r.profiles?.full_name ?? "Unknown",
        count: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

/** How many logged interactions each volunteer took part in during the
 * period — the volunteer-side equivalent of getStaffActivity, for
 * showing volunteer impact separately from staff impact. */
export async function getVolunteerImpact(period: ImpactPeriod = "month"): Promise<PersonImpactRow[]> {
  const supabase = await createClient();
  const start = periodStart(period);

  const { data, error } = await supabase
    .from("interaction_volunteers")
    .select("contact_id, contacts(name), interactions(occurred_at)");
  if (error) throw new Error(error.message);

  const counts = new Map<string, PersonImpactRow>();
  for (const row of data ?? []) {
    const r = row as unknown as {
      contact_id: string;
      contacts: { name: string } | null;
      interactions: { occurred_at: string } | null;
    };
    if (start && (!r.interactions || r.interactions.occurred_at < start)) continue;
    const existing = counts.get(r.contact_id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(r.contact_id, {
        id: r.contact_id,
        name: r.contacts?.name ?? "Unknown volunteer",
        count: 1,
      });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
