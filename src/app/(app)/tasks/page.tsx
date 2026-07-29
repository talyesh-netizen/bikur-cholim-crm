import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listTasks } from "@/lib/queries/tasks";
import { listActiveStaff } from "@/lib/queries/profiles";
import { TaskFilters } from "./task-filters";
import { TaskCard } from "./task-card";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [tasks, staff] = await Promise.all([
    listTasks({
      status: params.status,
      assignedTo: params.assigned,
      overdueOnly: params.overdue === "1",
    }),
    listActiveStaff(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} task{tasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="size-4" />
            Add task
          </Link>
        </Button>
      </div>

      <TaskFilters staff={staff} />

      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tasks match your filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
