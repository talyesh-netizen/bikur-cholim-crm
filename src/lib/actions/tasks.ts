"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain/task";

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

  const { error } = await supabase.from("tasks").insert({ ...parsed.data, created_by: user?.id });

  if (error) {
    return { error: "Something went wrong saving this task. Please try again.", values: raw };
  }

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
  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", taskId);

  if (error) {
    return { error: "Something went wrong saving this task. Please try again.", values: raw };
  }

  revalidateTaskPaths(parsed.data);
  revalidatePath(`/tasks/${taskId}`);
  redirect(redirectTo);
}

const statusChangeSchema = z.object({ status: z.enum(statusValues), completion_notes: optionalText() });

export async function setTaskStatus(taskId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = statusChangeSchema.safeParse(raw);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .update({
      status: parsed.data.status,
      completion_notes: parsed.data.completion_notes ?? null,
    })
    .eq("id", taskId)
    .select("resident_id, facility_id")
    .single();

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  if (task?.resident_id) revalidatePath(`/residents/${task.resident_id}`);
  if (task?.facility_id) revalidatePath(`/facilities/${task.facility_id}`);
}
