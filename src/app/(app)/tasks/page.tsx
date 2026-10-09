import { ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listTasks } from "@/lib/queries/tasks";
import { listActiveStaff } from "@/lib/queries/profiles";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getLocalToday } from "@/lib/format-date";
import { SectionIcon } from "@/components/section-icon";
import { TaskWorkspace } from "./task-workspace";

/** Tasks: one search box and four views -- Open, Today, Upcoming,
 * Completed (decided Oct 9, 2026). Every task, finished ones too, is
 * loaded once, so search and switching views are instant. */
export default async function TasksPage() {
  const [tasks, staff, me] = await Promise.all([
    listTasks({ showAllStatuses: true }),
    listActiveStaff(),
    getCurrentProfile(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <SectionIcon section="tasks" icon={ListChecks} />
          Tasks
        </h1>
        <Button asChild>
          <Link href="/tasks/new">
            <Plus className="size-4" />
            Add task
          </Link>
        </Button>
      </div>

      <TaskWorkspace tasks={tasks} staff={staff} today={getLocalToday()} myId={me?.id ?? null} />
    </div>
  );
}
