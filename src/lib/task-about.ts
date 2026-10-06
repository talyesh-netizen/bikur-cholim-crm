import { labelFor, TASK_CATEGORIES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";

/** "Seth Vilensky · CEO, Kendal at Oberlin", "Rivka Cohen · Maple Grove"... */
export function taskAboutLine(task: TaskWithNames): string {
  if (task.contact_name) {
    const parts = [task.contact_name, task.contact_detail ?? task.facility_name];
    if (task.resident_name) parts.push(`re: ${task.resident_name}`);
    return parts.filter(Boolean).join(" · ");
  }
  return [task.resident_name, task.facility_name].filter(Boolean).join(" · ") || labelFor(TASK_CATEGORIES, task.task_category);
}
