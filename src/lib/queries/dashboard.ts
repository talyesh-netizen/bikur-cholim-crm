import { createClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { listTasks, SELECT_WITH_NAMES, toTaskWithNames } from "./tasks";
import { listRecentInteractions } from "./interactions";
import { getLocalToday } from "@/lib/format-date";

// A resident with no logged visit in this many days shows up under
// "residents without a recent visit." Phase One keeps this a single
// simple number rather than parsing each resident's free-text
// preferred_visit_frequency — see the Design Principles in ROADMAP.md
// ("prefer clear workflows over advanced options").
const STALE_RESIDENT_VISIT_DAYS = 30;

// High-priority facilities get a shorter "needs attention" window than
// the resident default, since visit_priority already signals urgency.
const STALE_HIGH_PRIORITY_FACILITY_VISIT_DAYS = 14;

/** Today shows only the first few of each list; Needs attention has them all. */
export const TODAY_SNAPSHOT_SIZE = 5;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export type DashboardSummary = {
  overdueTasks: TaskWithNames[];
  dueTodayTasks: TaskWithNames[];
  /** The few longest-waiting, for the Today snapshot... */
  staleResidents: ResidentWithSummary[];
  /** ...and how many there are in all (the full list is on Needs attention). */
  staleResidentsTotal: number;
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
  const today = getLocalToday();
  const staleResidentCutoff = daysAgoIso(STALE_RESIDENT_VISIT_DAYS);

  const [
    overdueTasks,
    dueTodayTasksRaw,
    staleResidentsRaw,
    facilitiesNeedingAttention,
    recentActivity,
    openTasksCount,
    activeResidentsCount,
    activeFacilitiesCount,
  ] = await Promise.all([
    listTasks({ overdueOnly: true }),
    supabase
      .from("tasks")
      .select(SELECT_WITH_NAMES)
      .eq("due_date", today)
      .in("status", OPEN_TASK_STATUSES as unknown as string[]),
    supabase
      .from("resident_summary")
      .select("*", { count: "exact" })
      .in("status", ACTIVE_RESIDENT_STATUSES)
      .or(`last_visit_at.is.null,last_visit_at.lt.${staleResidentCutoff}`)
      .order("last_visit_at", { ascending: true, nullsFirst: true })
      .limit(TODAY_SNAPSHOT_SIZE),
    getFacilitiesNeedingAttention(),
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

  const dueTodayTasks = (dueTodayTasksRaw.data ?? []).map((row) =>
    toTaskWithNames(row as unknown as Parameters<typeof toTaskWithNames>[0])
  );

  return {
    overdueTasks,
    dueTodayTasks,
    staleResidents: (staleResidentsRaw.data ?? []) as ResidentWithSummary[],
    staleResidentsTotal: staleResidentsRaw.count ?? 0,
    facilitiesNeedingAttention,
    recentActivity,
    counts: {
      openTasks: openTasksCount.count ?? 0,
      activeResidents: activeResidentsCount.count ?? 0,
      activeFacilities: activeFacilitiesCount.count ?? 0,
    },
  };
}

/** Facilities flagged "follow up needed", plus high-priority ones with
 * nothing logged in STALE_HIGH_PRIORITY_FACILITY_VISIT_DAYS -- one list,
 * no duplicates, longest-quiet first. Used by Today (first few) and
 * Needs attention (all). */
export async function getFacilitiesNeedingAttention(): Promise<FacilityWithSummary[]> {
  const supabase = await createClient();
  const staleFacilityCutoff = daysAgoIso(STALE_HIGH_PRIORITY_FACILITY_VISIT_DAYS);
  const [followUp, highPriority] = await Promise.all([
    supabase.from("facility_summary").select("*").eq("active", true).eq("engagement_status", "follow_up_needed"),
    supabase
      .from("facility_summary")
      .select("*")
      .eq("active", true)
      .eq("visit_priority", "high")
      .or(`last_visit_at.is.null,last_visit_at.lt.${staleFacilityCutoff}`),
  ]);
  if (followUp.error) throw new Error(followUp.error.message);
  if (highPriority.error) throw new Error(highPriority.error.message);
  const byId = new Map<string, FacilityWithSummary>();
  for (const f of [...(followUp.data ?? []), ...(highPriority.data ?? [])] as FacilityWithSummary[]) byId.set(f.id, f);
  return [...byId.values()].sort((a, b) => (a.last_visit_at ?? "").localeCompare(b.last_visit_at ?? ""));
}
