import { createClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import type { FacilityWithSummary } from "@/lib/domain/facility";
import { ACTIVE_RESIDENT_STATUSES } from "@/lib/domain/resident";
import type { ResidentWithSummary } from "@/lib/domain/resident";
import { listTasks, SELECT_WITH_NAMES, toTaskWithNames } from "./tasks";
import { listRecentInteractions } from "./interactions";
import { getLocalToday, orgDayStartIso } from "@/lib/format-date";
import { currentQuarter } from "@/lib/report-period";
import { fetchLastStaffVisits } from "./report-rules";

// A resident with no logged visit in this many days shows up under
// "residents without a recent visit." Phase One keeps this a single
// simple number rather than parsing each resident's free-text
// preferred_visit_frequency — see the Design Principles in ROADMAP.md
// ("prefer clear workflows over advanced options").
const STALE_RESIDENT_VISIT_DAYS = 30;

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
  facilitiesNeedingAttention: CoverageGapFacility[];
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

/** Quarterly coverage (Nov 27, 2026): active facilities with Jewish
 * residents on file and no staff visit (in person, confirmed) logged this
 * quarter, longest without one first, each with this quarter's volunteer
 * activity beside it. Used by Needs attention (all) and Today. */
export type CoverageGapFacility = FacilityWithSummary & {
  last_staff_visit_at: string | null;
  /** Volunteer visits there this quarter (entries) and the newest one. */
  volunteer_visits_this_quarter: number;
  last_volunteer_visit_at: string | null;
};

export async function getFacilitiesNeedingAttention(): Promise<CoverageGapFacility[]> {
  const supabase = await createClient();
  const quarter = currentQuarter();
  const quarterStart = orgDayStartIso(quarter.from!)!;
  const [{ data, error }, lastStaff, volunteer] = await Promise.all([
    supabase.from("facility_summary").select("*").eq("active", true).gt("active_resident_count", 0),
    fetchLastStaffVisits(supabase),
    supabase
      .from("interactions")
      .select("facility_id, occurred_at")
      .eq("interaction_type", "volunteer_visit")
      .is("voided_at", null)
      .is("counted_in_id", null)
      .not("facility_id", "is", null)
      .gte("occurred_at", quarterStart),
  ]);
  if (error) throw new Error(error.message);
  if (volunteer.error) throw new Error(volunteer.error.message);
  const vol = new Map<string, { n: number; last: string }>();
  for (const v of volunteer.data ?? []) {
    const cur = vol.get(v.facility_id as string);
    vol.set(v.facility_id as string, { n: (cur?.n ?? 0) + 1, last: !cur || v.occurred_at > cur.last ? v.occurred_at : cur.last });
  }
  return ((data ?? []) as FacilityWithSummary[])
    .map((f) => ({
      ...f,
      last_staff_visit_at: lastStaff.get(f.id) ?? null,
      volunteer_visits_this_quarter: vol.get(f.id)?.n ?? 0,
      last_volunteer_visit_at: vol.get(f.id)?.last ?? null,
    }))
    .filter((f) => !f.last_staff_visit_at || f.last_staff_visit_at < quarterStart)
    .sort((a, b) => (a.last_staff_visit_at ?? "").localeCompare(b.last_staff_visit_at ?? "") || a.name.localeCompare(b.name));
}
