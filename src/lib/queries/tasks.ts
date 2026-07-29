import { createClient } from "@/lib/supabase/server";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { Task, TaskWithNames } from "@/lib/domain/task";

const SELECT_WITH_NAMES =
  "*, residents(first_name, last_name, preferred_name), facilities(name), profiles!tasks_assigned_to_fkey(full_name)";

function toTaskWithNames(row: {
  residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
  facilities: { name: string } | null;
  profiles: { full_name: string } | null;
  [key: string]: unknown;
}): TaskWithNames {
  const { residents: resident, facilities, profiles, ...task } = row;
  return {
    ...(task as unknown as Task),
    resident_name: resident
      ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}`
      : null,
    facility_name: facilities?.name ?? null,
    assigned_to_name: profiles?.full_name ?? null,
  };
}

export type TaskFilters = {
  status?: string;
  assignedTo?: string;
  overdueOnly?: boolean;
  showAllStatuses?: boolean;
  residentId?: string;
  facilityId?: string;
};

export async function listTasks(filters: TaskFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(SELECT_WITH_NAMES)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else if (!filters.showAllStatuses) {
    query = query.in("status", OPEN_TASK_STATUSES as unknown as string[]);
  }
  if (filters.assignedTo) {
    query = query.eq("assigned_to", filters.assignedTo);
  }
  if (filters.residentId) {
    query = query.eq("resident_id", filters.residentId);
  }
  if (filters.facilityId) {
    query = query.eq("facility_id", filters.facilityId);
  }
  if (filters.overdueOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query
      .lt("due_date", today)
      .in("status", OPEN_TASK_STATUSES as unknown as string[]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toTaskWithNames(row as unknown as Parameters<typeof toTaskWithNames>[0]));
}

export async function getTask(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select(SELECT_WITH_NAMES).eq("id", id).single();
  if (error) return null;
  return toTaskWithNames(data as unknown as Parameters<typeof toTaskWithNames>[0]);
}
