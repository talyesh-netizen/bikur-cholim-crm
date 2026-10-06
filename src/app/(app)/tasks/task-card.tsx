import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
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

export function TaskCard({ task }: { task: TaskWithNames }) {
  const overdue = isTaskOverdue(task);
  const dueToday = task.due_date === getLocalToday();
  const dueDate = formatDateOnly(task.due_date);
  const who = TASK_WHO[taskWho(task)];

  return (
    <Link href={`/tasks/${task.id}`} className="group block">
      <Card
        className="overflow-hidden border-l-4 transition-colors group-hover:border-primary/50"
        style={{ borderLeftColor: who.color }}
      >
        <CardContent className="flex flex-col gap-2 p-4 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-snug">{task.title}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: who.color }} />
                <span className="shrink-0 font-medium text-foreground">{who.label}</span>
                <span className="truncate">· {taskAboutLine(task)}</span>
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
