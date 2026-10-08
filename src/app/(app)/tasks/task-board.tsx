import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUSES, OPEN_TASK_STATUSES, OFFERED_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { TaskStatusSelect } from "./task-status-select";
import { TASK_WHO, taskWho } from "@/lib/category-colors";
import { taskAboutLine } from "@/lib/task-about";
import { formatDateOnly, getLocalToday } from "@/lib/format-date";

// Cancelled tasks aren't actionable, so they don't get a column here --
// same idea as hiding inactive facilities/contacts from the main list.
// Two columns: Open and Done. An older "in progress" / "waiting" task
// shows under Open.
const BOARD_STATUSES = TASK_STATUSES.filter((s) => (OFFERED_TASK_STATUSES as readonly string[]).includes(s.value));

function priorityVariant(priority: string): "destructive" | "warning" | "secondary" {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "warning";
  return "secondary";
}

function isOverdue(task: TaskWithNames): boolean {
  if (!task.due_date) return false;
  if (!(OPEN_TASK_STATUSES as readonly string[]).includes(task.status)) return false;
  return task.due_date < getLocalToday();
}

/** A Trello-style status board -- no drag-and-drop, but each card's
 * status can be changed in place via a dropdown, so moving a task
 * between columns takes one click instead of opening its full page. */
export function TaskBoard({ tasks }: { tasks: TaskWithNames[] }) {
  const columns = BOARD_STATUSES.map((s) => ({
    ...s,
    tasks: tasks.filter((t) =>
      s.value === "open" ? (OPEN_TASK_STATUSES as readonly string[]).includes(t.status) : t.status === s.value
    ),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {columns.map((column) => (
        <div key={column.value} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{column.label}</h2>
            <span className="text-xs text-muted-foreground">{column.tasks.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {column.tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Nothing here.
              </p>
            ) : (
              column.tasks.map((task) => {
                const overdue = isOverdue(task);
                const dueDate = formatDateOnly(task.due_date);
                const who = TASK_WHO[taskWho(task)];
                return (
                  <div
                    key={task.id}
                    className={
                      overdue
                        ? "flex flex-col gap-2 rounded-md border border-l-4 border-destructive/50 bg-card p-3"
                        : "flex flex-col gap-2 rounded-md border border-l-4 border-border bg-card p-3"
                    }
                    style={{ borderLeftColor: who.color }}
                  >
                    <Link href={`/tasks/${task.id}`} className="flex flex-col gap-1 hover:underline">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: who.color }} />
                        <span className="shrink-0 font-medium text-foreground">{who.label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{taskAboutLine(task)}</span>
                    </Link>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={priorityVariant(task.priority)} className="text-[10px]">
                        {task.priority}
                      </Badge>
                      {dueDate ? (
                        <span className={overdue ? "text-[11px] font-medium text-destructive" : "text-[11px] text-muted-foreground"}>
                          {overdue ? "Overdue — " : ""}
                          {dueDate}
                        </span>
                      ) : null}
                    </div>

                    {task.assigned_to_name ? (
                      <p className="text-[11px] text-muted-foreground">Assigned to {task.assigned_to_name}</p>
                    ) : null}

                    <TaskStatusSelect taskId={task.id} status={task.status} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
