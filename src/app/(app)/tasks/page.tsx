import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid, List as ListIcon } from "lucide-react";
import { listTasks } from "@/lib/queries/tasks";
import { listActiveStaff } from "@/lib/queries/profiles";
import { TaskFilters } from "./task-filters";
import { TaskCard } from "./task-card";
import { TaskBoard } from "./task-board";
import { cn } from "@/lib/utils";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";

  const [tasks, staff] = await Promise.all([
    listTasks({
      status: params.status,
      assignedTo: params.assigned,
      overdueOnly: params.overdue === "1",
      // The board shows a Completed column too, so it needs every
      // status; the list view keeps its original "open work only"
      // default unless a status/overdue filter narrows it.
      showAllStatuses: view === "board" || undefined,
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
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            <ViewLink view="board" current={view} icon={LayoutGrid} label="Board" params={params} />
            <ViewLink view="list" current={view} icon={ListIcon} label="List" params={params} />
          </div>
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="size-4" />
              Add task
            </Link>
          </Button>
        </div>
      </div>

      <TaskFilters staff={staff} />

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks match these filters"
          description="Try a different status or person, or clear the filters. Open follow-ups from visits show up here."
          action={{ href: "/tasks/new", label: "Add a follow-up task" }}
        />
      ) : view === "board" ? (
        <TaskBoard tasks={tasks} />
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

function ViewLink({
  view,
  current,
  icon: Icon,
  label,
  params,
}: {
  view: "board" | "list";
  current: string;
  icon: typeof LayoutGrid;
  label: string;
  params: Record<string, string | undefined>;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  );
  search.set("view", view);

  return (
    <Link
      href={`/tasks?${search.toString()}`}
      className={cn(
        "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        current === view ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  );
}
