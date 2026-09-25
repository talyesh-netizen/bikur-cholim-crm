import Link from "next/link";
import { TaskStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { OPEN_TASK_STATUSES } from "@/lib/domain/task";
import type { TaskWithNames } from "@/lib/domain/task";
import { formatDateOnly, getLocalToday } from "@/lib/format-date";
import { isTaskOverdue } from "./task-card";
import { ListChecks, ChevronRight } from "lucide-react";

/** Compact task list shown on resident/facility pages — the full
 * details live on the task's own page (linked from each row). Open
 * tasks come first; finished ones are tucked behind a toggle so the
 * section answers "what still needs doing?" at a glance. */
export function TaskList({
  tasks,
  emptyAction,
  showResident = false,
}: {
  tasks: TaskWithNames[];
  /** On a facility page, say which resident each follow-up is for. */
  showResident?: boolean;
  /** Where "add one" should go when there are no open tasks. */
  emptyAction?: { href: string; label: string };
}) {
  const open = tasks.filter((t) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status));
  const closed = tasks.filter((t) => !(OPEN_TASK_STATUSES as readonly string[]).includes(t.status));

  return (
    <div className="flex flex-col gap-3">
      {open.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No open follow-ups"
          description={
            closed.length > 0
              ? "Everything here has been completed. Add a task if something new comes up."
              : "Nothing is waiting on anyone. Add a follow-up task after a visit if something needs doing — a call back, a referral, a delivery."
          }
          action={emptyAction}
        />
      ) : (
        <TaskRows tasks={open} showResident={showResident} />
      )}

      {closed.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none py-1 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span className="group-open:hidden">Show {closed.length} completed or cancelled</span>
            <span className="hidden group-open:inline">Hide completed or cancelled</span>
          </summary>
          <div className="mt-2 opacity-80">
            <TaskRows tasks={closed} showResident={showResident} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TaskRows({ tasks, showResident }: { tasks: TaskWithNames[]; showResident: boolean }) {
  const today = getLocalToday();
  return (
    <ul className="-mx-2 flex flex-col">
      {tasks.map((task) => {
        const overdue = isTaskOverdue(task);
        const dueDate = formatDateOnly(task.due_date);
        return (
          <li key={task.id}>
            <Link
              href={`/tasks/${task.id}`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent/60"
            >
              <div className="min-w-0">
                <p className="font-medium leading-snug">
                  {task.title}
                  {showResident && task.resident_name ? (
                    <span className="font-normal text-muted-foreground"> · {task.resident_name}</span>
                  ) : null}
                </p>
                <p className={overdue ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>
                  {dueDate
                    ? overdue
                      ? `Overdue — was due ${dueDate}`
                      : task.due_date === today
                        ? "Due today"
                        : `Due ${dueDate}`
                    : "No due date"}
                  {task.assigned_to_name ? ` · ${task.assigned_to_name}` : ""}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <TaskStatusBadge status={task.status} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
