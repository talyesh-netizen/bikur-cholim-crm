import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/status-badge";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatDateOnly, getLocalToday } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { TASK_WHO, taskWho } from "@/lib/category-colors";
import { taskAboutLine } from "@/lib/task-about";

export function isTaskOverdue(task: Pick<TaskWithNames, "due_date" | "status">): boolean {
  if (!task.due_date) return false;
  if (!(OPEN_TASK_STATUSES as readonly string[]).includes(task.status)) return false;
  return task.due_date < getLocalToday();
}

/** One task. Urgency isn't shown or asked for any more (decided Oct 9,
 * 2026); a task's stored priority is kept, just not in the way. */
export function TaskCard({
  task,
  href,
  leading,
}: {
  task: TaskWithNames;
  /** Defaults to the task's page; the task list adds its own settings
   * so coming back lands on the same tab and search. */
  href?: string;
  /** Something before the text, e.g. the task list's Done circle. */
  leading?: React.ReactNode;
}) {
  const open = (OPEN_TASK_STATUSES as readonly string[]).includes(task.status);
  const overdue = isTaskOverdue(task);
  const dueToday = open && task.due_date === getLocalToday();
  const dueDate = formatDateOnly(task.due_date);
  const who = TASK_WHO[taskWho(task)];

  return (
    <Card
      className={cn("overflow-hidden border-l-4 transition-colors hover:border-primary/50", !open && "opacity-80")}
      style={{ borderLeftColor: who.color }}
    >
      <CardContent className="flex items-start gap-3 p-4 sm:p-4">
        {leading}
        <Link href={href ?? `/tasks/${task.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-base font-semibold leading-snug", !open && "text-muted-foreground line-through decoration-1")}>
                {task.title}
              </p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: who.color }} />
                <span className="shrink-0 font-medium text-foreground">{who.label}</span>
                <span className="truncate">· {taskAboutLine(task)}</span>
              </p>
            </div>
            {/* "Open" goes without saying; anything else is worth a word. */}
            {task.status !== "open" ? <TaskStatusBadge status={task.status} className="shrink-0" /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            {open ? (
              <span
                className={cn(
                  "flex items-center gap-1.5",
                  overdue ? "font-medium text-destructive" : dueToday ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                <CalendarClock className="size-4" />
                {dueDate ? (overdue ? `Overdue — was due ${dueDate}` : dueToday ? "Due today" : `Due ${dueDate}`) : "No due date"}
              </span>
            ) : null}
            {task.assigned_to_name ? <span className="text-muted-foreground">{task.assigned_to_name}</span> : null}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
