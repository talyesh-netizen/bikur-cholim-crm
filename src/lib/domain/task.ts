/**
 * Task-related types and option lists. Must stay in sync with the CHECK
 * constraints in supabase/migrations/20260727000011_tasks.sql — see the
 * same note in src/lib/domain/facility.ts for why.
 */

export { labelFor } from "./options";

export const TASK_PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const TASK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

/** Statuses that still represent open, unfinished work — used to
 * decide what counts toward "overdue" and default list filtering. */
export const OPEN_TASK_STATUSES = ["open", "in_progress", "waiting"] as const;

export const TASK_CATEGORIES = [
  { value: "visit", label: "Visit" },
  { value: "phone_call", label: "Phone call" },
  { value: "family_follow_up", label: "Family follow-up" },
  { value: "facility_follow_up", label: "Facility follow-up" },
  { value: "volunteer_coordination", label: "Volunteer coordination" },
  { value: "program_planning", label: "Program planning" },
  { value: "kosher_food", label: "Kosher food" },
  { value: "referral", label: "Referral" },
  { value: "hospital_follow_up", label: "Hospital follow-up" },
  { value: "resident_transition", label: "Resident transition" },
  { value: "other", label: "Other" },
] as const;

export type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  facility_id: string | null;
  resident_id: string | null;
  contact_id: string | null;
  interaction_id: string | null;
  task_category: string;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** A task row plus the resident/facility/assignee names needed to
 * display it in a list — see lib/queries/tasks.ts. */
export type TaskWithNames = Task & {
  resident_name: string | null;
  facility_name: string | null;
  assigned_to_name: string | null;
};
