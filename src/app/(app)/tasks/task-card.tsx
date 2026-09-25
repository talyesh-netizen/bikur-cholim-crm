import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { labelFor, TASK_CATEGORIES, OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatDateOnly, getLocalToday } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

export function isTaskOverdue(task: Pick<TaskWithNames, "due_date" | "status">): boolean {
  if (!task.due_date) return false;
  if (!(OPEN_TASK_STATUSES as readonly string[]).includes(task.status)) return false;
  return task.due_date < getLocalToday();
}

export function TaskCard({ task }: { task: TaskWithNames }) {
  const overdue = isTaskOverdue(task);
  const dueToday = task.due_date === getLocalToday();
  const dueDate = formatDateOnly(task.due_date);

  return (
    <Link href={`/tasks/${task.id}`} className="group block">
      <Card
        className={cn(
          "transition-colors group-hover:border-primary/50",
          overdue && "border-l-4 border-l-destructive"
        )}
      >
        <CardContent className="flex flex-col gap-2 p-4 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug">{task.title}</p>
              <p className="text-sm text-muted-foreground">
                {[task.resident_name, task.facility_name].filter(Boolean).join(" · ") ||
                  labelFor(TASK_CATEGORIES, task.task_category)}
              </p>
            </div>
            <TaskStatusBadge status={task.status} className="shrink-0" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span
              className={cn(
                "flex items-center gap-1.5",
                overdue ? "font-medium text-destructive" : dueToday ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              <CalendarClock className="size-4" />
              {dueDate ? (overdue ? `Overdue — was due ${dueDate}` : dueToday ? "Due today" : `Due ${dueDate}`) : "No due date"}
            </span>
            {task.priority === "high" ? <PriorityBadge priority="high" kind="task" /> : null}
            {task.assigned_to_name ? <span className="text-muted-foreground">{task.assigned_to_name}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
