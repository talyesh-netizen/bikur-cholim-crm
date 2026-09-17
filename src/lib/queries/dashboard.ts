import { createClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { listTasks } from "./tasks";
import { listRecentInteractions } from "./interactions";

// A resident with no logged visit in this many days shows up under
// "residents without a recent visit." Phase One keeps this a single
// simple number rather than parsing each resident's free-text
// preferred_visit_frequency — see the Design Principles in ROADMAP.md
// ("prefer clear workflows over advanced options").
const STALE_RESIDENT_VISIT_DAYS = 30;

// High-priority facilities get a shorter "needs attention" window than
// the resident default, since visit_priority already signals urgency.
const STALE_HIGH_PRIORITY_FACILITY_VISIT_DAYS = 14;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export type DashboardSummary = {
  overdueTasks: TaskWithNames[];
  dueTodayTasks: TaskWithNames[];
  staleResidents: ResidentWithSummary[];
  facilitiesNeedingAttention: FacilityWithSummary[];
  recentActivity: Awaited<ReturnType<typeof listRecentInteractions>>;
  counts: {
    openTasks: number;
    activeResidents: number;
    activeFacilities: number;
  };
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const staleResidentCutoff = daysAgoIso(STALE_RESIDENT_VISIT_DAYS);
  const staleFacilityCutoff = daysAgoIso(STALE_HIGH_PRIORITY_FACILITY_VISIT_DAYS);

  const [
    overdueTasks,
    dueTodayTasksRaw,
    staleResidentsRaw,
    followUpFacilitiesRaw,
    highPriorityFacilitiesRaw,
    recentActivity,
    openTasksCount,
    activeResidentsCount,
    activeFacilitiesCount,
  ] = await Promise.all([
    listTasks({ overdueOnly: true }),
    supabase
      .from("tasks")
      .select("*, residents(first_name, last_name, preferred_name), facilities(name), profiles!tasks_assigned_to_fkey(full_name)")
      .eq("due_date", today)
      .in("status", OPEN_TASK_STATUSES as unknown as string[]),
    supabase
      .from("resident_summary")
      .select("*")
      .in("status", ACTIVE_RESIDENT_STATUSES)
      .or(`last_visit_at.is.null,last_visit_at.lt.${staleResidentCutoff}`)
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(10),
    supabase
      .from("facility_summary")
      .select("*")
      .eq("active", true)
      .eq("engagement_status", "follow_up_needed"),
    supabase
      .from("facility_summary")
      .select("*")
      .eq("active", true)
      .eq("visit_priority", "high")
      .or(`last_visit_at.is.null,last_visit_at.lt.${staleFacilityCutoff}`),
    listRecentInteractions(8),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_TASK_STATUSES as unknown as string[]),
    supabase
      .from("residents")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_RESIDENT_STATUSES),
    supabase
      .from("facilities")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);

  if (dueTodayTasksRaw.error) throw new Error(dueTodayTasksRaw.error.message);
  if (staleResidentsRaw.error) throw new Error(staleResidentsRaw.error.message);
  if (followUpFacilitiesRaw.error) throw new Error(followUpFacilitiesRaw.error.message);
  if (highPriorityFacilitiesRaw.error) throw new Error(highPriorityFacilitiesRaw.error.message);

  const dueTodayTasks = (dueTodayTasksRaw.data ?? []).map((row) => {
    const r = row as unknown as {
      residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
      facilities: { name: string } | null;
      profiles: { full_name: string } | null;
      [key: string]: unknown;
    };
    const { residents, facilities, profiles, ...task } = r;
    return {
      ...(task as unknown as TaskWithNames),
      resident_name: residents ? `${residents.preferred_name ?? residents.first_name} ${residents.last_name}` : null,
      facility_name: facilities?.name ?? null,
      assigned_to_name: profiles?.full_name ?? null,
    };
  });

  // Merge the two "needs attention" facility queries and de-duplicate
  // (a facility can be both follow-up-flagged and high-priority-stale).
  const facilityById = new Map<string, FacilityWithSummary>();
  for (const f of [...(followUpFacilitiesRaw.data ?? []), ...(highPriorityFacilitiesRaw.data ?? [])] as FacilityWithSummary[]) {
    facilityById.set(f.id, f);
  }

  return {
    overdueTasks,
    dueTodayTasks,
    staleResidents: (staleResidentsRaw.data ?? []) as ResidentWithSummary[],
    facilitiesNeedingAttention: Array.from(facilityById.values()),
    recentActivity,
    counts: {
      openTasks: openTasksCount.count ?? 0,
      activeResidents: activeResidentsCount.count ?? 0,
      activeFacilities: activeFacilitiesCount.count ?? 0,
    },
  };
}
