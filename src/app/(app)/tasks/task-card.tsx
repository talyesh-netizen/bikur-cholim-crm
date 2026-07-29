import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelFor, TASK_CATEGORIES, TASK_STATUSES, OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatDateOnly } from "@/lib/format-date";

function priorityVariant(priority: string): "destructive" | "warning" | "secondary" {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "warning";
  return "secondary";
}

function isOverdue(task: TaskWithNames): boolean {
  if (!task.due_date) return false;
  if (!(OPEN_TASK_STATUSES as readonly string[]).includes(task.status)) return false;
  return task.due_date < new Date().toISOString().slice(0, 10);
}

export function TaskCard({ task }: { task: TaskWithNames }) {
  const overdue = isOverdue(task);
  const dueDate = formatDateOnly(task.due_date);

  return (
    <Link href={`/tasks/${task.id}`}>
      <Card className={overdue ? "border-destructive/50 transition-colors" : "transition-colors hover:border-primary/50"}>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{task.title}</p>
              <span className="text-sm text-muted-foreground">
                {[task.resident_name, task.facility_name].filter(Boolean).join(" · ") ||
                  labelFor(TASK_CATEGORIES, task.task_category)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
              <Badge variant="secondary">{labelFor(TASK_STATUSES, task.status)}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {dueDate ? (
              <span className={overdue ? "font-medium text-destructive" : undefined}>
                {overdue ? "Overdue — " : "Due "}
                {dueDate}
              </span>
            ) : (
              <span>No due date</span>
            )}
            {task.assigned_to_name ? <span>Assigned to {task.assigned_to_name}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
