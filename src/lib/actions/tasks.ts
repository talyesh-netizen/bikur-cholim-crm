"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/task";
import { notifyTaskAssigned } from "@/lib/notify-task-assigned";

const categoryValues = TASK_CATEGORIES.map((o) => o.value) as [string, ...string[]];
const priorityValues = TASK_PRIORITIES.map((o) => o.value) as [string, ...string[]];
const statusValues = TASK_STATUSES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalUuid = () => z.preprocess(emptyToUndefined, z.string().uuid().optional());

export type TaskFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back what was typed so a failed save never silently discards
  // it — same pattern as lib/actions/facilities.ts and residents.ts.
  values?: Record<string, string>;
};

const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: optionalText(),
  due_date: optionalText(),
  priority: z.enum(priorityValues),
  task_category: z.enum(categoryValues),
  assigned_to: optionalUuid(),
  resident_id: optionalUuid(),
  facility_id: optionalUuid(),
  interaction_id: optionalUuid(),
});

function flattenErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function revalidateTaskPaths(task: { resident_id?: string; facility_id?: string }) {
  revalidatePath("/tasks");
  if (task.resident_id) revalidatePath(`/residents/${task.resident_id}`);
  if (task.facility_id) revalidatePath(`/facilities/${task.facility_id}`);
}

export async function createTask(
  redirectTo: string,
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Something went wrong saving this task. Please try again.", values: raw };
  }

  if (parsed.data.assigned_to) await notifyTaskAssigned(supabase, created.id, user?.id);

  revalidateTaskPaths(parsed.data);
  redirect(redirectTo);
}

export async function updateTask(
  taskId: string,
  redirectTo: string,
  _prevState: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only email when the task is being handed to someone new -- not on
  // every edit of a task they already have.
  const { data: before } = await supabase.from("tasks").select("assigned_to").eq("id", taskId).single();

  const { data: updated, error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId).select("id");

  if (error) {
    return { error: "Something went wrong saving this task. Please try again.", values: raw };
  }
  if (!updated || updated.length === 0) {
    return { error: "Changes NOT saved: this record no longer exists or you don't have access to it.", values: raw };
  }

  if (parsed.data.assigned_to && parsed.data.assigned_to !== before?.assigned_to) {
    await notifyTaskAssigned(supabase, taskId, user?.id);
  }

  revalidateTaskPaths(parsed.data);
  revalidatePath(`/tasks/${taskId}`);
  redirect(redirectTo);
}

const statusChangeSchema = z.object({ status: z.enum(statusValues), completion_notes: optionalText() });

export async function setTaskStatus(taskId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = statusChangeSchema.safeParse(raw);
  if (!parsed.success) throw new Error("That task status isn't valid.");

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      completion_notes: parsed.data.completion_notes ?? null,
    })
    .eq("id", taskId)
    .select("resident_id, facility_id")
    .maybeSingle();

  // Shown on the app's error screen rather than silently leaving the
  // task as it was -- a "completed" click that didn't stick must be obvious.
  if (error || !task) {
    throw new Error("This task's status was NOT changed. Please reload the page and try again.");
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (task?.resident_id) revalidatePath(`/residents/${task.resident_id}`);
  if (task?.facility_id) revalidatePath(`/facilities/${task.facility_id}`);
}

const OPEN_STATUS_VALUES = ["open", "in_progress", "waiting"] as const;

/** Only the task list's own settings survive the trip to a task and
 * back (tab, search, person) -- and the result always stays on /tasks,
 * so a crafted link can't send anyone elsewhere. */
function taskListQuery(back: string | null | undefined): URLSearchParams {
  const from = new URLSearchParams(back ?? "");
  const kept = new URLSearchParams();
  for (const key of ["tab", "q", "assigned"]) {
    const value = from.get(key);
    if (value) kept.set(key, value);
  }
  return kept;
}

async function changeStatus(taskId: string, status: string, completionNotes?: string) {
  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("status").eq("id", taskId).maybeSingle();
  const update: { status: string; completion_notes?: string | null } = { status };
  // Undo and one-tap Done leave any completion notes as they were.
  if (completionNotes !== undefined) update.completion_notes = completionNotes || null;
  const { data: task, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .select("resident_id, facility_id")
    .maybeSingle();
  if (error || !task || !before) return null;

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
  if (task.resident_id) revalidatePath(`/residents/${task.resident_id}`);
  if (task.facility_id) revalidatePath(`/facilities/${task.facility_id}`);
  return { previousStatus: before.status as string };
}

export type QuickStatusResult = { ok: true; previousStatus: string } | { ok: false; error: string };

/** One tap on the task list: Done, staying on the list. Returns what
 * the task was before, so Undo can put it back exactly. */
export async function completeTaskQuick(taskId: string): Promise<QuickStatusResult> {
  const result = await changeStatus(taskId, "completed");
  if (!result) return { ok: false, error: "This task was NOT marked done. Please reload and try again." };
  return { ok: true, previousStatus: result.previousStatus };
}

/** Undo a Done: back to the open status it had before. */
export async function undoTaskCompletion(taskId: string, previousStatus: string): Promise<QuickStatusResult> {
  const status = (OPEN_STATUS_VALUES as readonly string[]).includes(previousStatus) ? previousStatus : "open";
  const result = await changeStatus(taskId, status);
  if (!result) return { ok: false, error: "This task could NOT be reopened. Please reload and try again." };
  return { ok: true, previousStatus: result.previousStatus };
}

const finishSchema = z.object({ status: z.enum(["completed", "cancelled"]), completion_notes: optionalText() });

/** Complete (or cancel) from a task's own page, then straight back to
 * the task list as it was -- same tab, same search -- where a short
 * message offers Undo. */
export async function finishTaskAndReturn(taskId: string, back: string, formData: FormData) {
  const parsed = finishSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("That task status isn't valid.");
  const result = await changeStatus(taskId, parsed.data.status, parsed.data.completion_notes ?? "");
  if (!result) throw new Error("This task's status was NOT changed. Please reload the page and try again.");

  const query = taskListQuery(back);
  query.set("done", taskId);
  query.set("was", result.previousStatus);
  if (parsed.data.status === "cancelled") query.set("cancelled", "1");
  redirect(`/tasks?${query.toString()}`);
}
