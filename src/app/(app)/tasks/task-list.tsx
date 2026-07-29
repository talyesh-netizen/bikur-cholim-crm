import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { labelFor, TASK_STATUSES, OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatDateOnly } from "@/lib/format-date";

/** Compact task list shown on resident/facility pages — the full
 * details live on the task's own page (linked from each row). */
export function TaskList({ tasks }: { tasks: TaskWithNames[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No follow-up tasks on file yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => {
        const overdue =
          task.due_date &&
          (OPEN_TASK_STATUSES as readonly string[]).includes(task.status) &&
          task.due_date < new Date().toISOString().slice(0, 10);
        const dueDate = formatDateOnly(task.due_date);
        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="flex items-start justify-between gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <div>
                <p className="font-medium">{task.title}</p>
                <p className={overdue ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                  {dueDate ? `${overdue ? "Overdue — " : "Due "}${dueDate}` : "No due date"}
                  {task.assigned_to_name ? ` · ${task.assigned_to_name}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{labelFor(TASK_STATUSES, task.status)}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
