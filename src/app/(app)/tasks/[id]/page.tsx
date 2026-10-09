import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getTask } from "@/lib/queries/tasks";
import { setTaskStatus, finishTaskAndReturn } from "@/lib/actions/tasks";
import { labelFor, TASK_CATEGORIES, TASK_STATUSES } from "@/lib/domain/task";
import { formatDateOnly } from "@/lib/format-date";
import { ArrowLeft, Pencil } from "lucide-react";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** The task list's tab and search, to go back to (see TaskWorkspace). */
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back = "" } = await searchParams;
  const task = await getTask(id);
  if (!task) notFound();

  const changeStatus = setTaskStatus.bind(null, task.id);
  // Done or Cancel goes straight back to the task list as it was.
  const finish = finishTaskAndReturn.bind(null, task.id, back);
  const isOpen = task.status === "open" || task.status === "in_progress" || task.status === "waiting";

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2 -mb-2 self-start">
        <Link href={`/tasks${back ? `?${back}` : ""}`}>
          <ArrowLeft className="size-4" />
          Tasks
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{task.title}</h1>
          <p className="text-sm text-muted-foreground">
            {labelFor(TASK_CATEGORIES, task.task_category)}
            {task.resident_id && task.resident_name ? (
              <>
                {" · "}
                <Link href={`/residents/${task.resident_id}`} className="font-medium text-foreground hover:underline">
                  {task.resident_name}
                </Link>
              </>
            ) : null}
            {task.facility_id && task.facility_name ? (
              <>
                {" · "}
                <Link href={`/facilities/${task.facility_id}`} className="font-medium text-foreground hover:underline">
                  {task.facility_name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/tasks/${task.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>{labelFor(TASK_STATUSES, task.status)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <InfoRow label="Due date" value={formatDateOnly(task.due_date)} />
          <InfoRow label="Assigned to" value={task.assigned_to_name} />
          {task.description ? (
            <div>
              <p className="text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap">{task.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {task.completion_notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {task.completion_notes}
          </CardContent>
        </Card>
      ) : null}

      {isOpen ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finished?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={finish} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="completion_notes">Completion notes (optional)</Label>
                <Textarea id="completion_notes" name="completion_notes" rows={2} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" name="status" value="completed" className="h-11 flex-1 sm:flex-none">
                  Mark done
                </Button>
                <Button type="submit" name="status" value="cancelled" variant="outline" className="h-11">
                  Cancel task
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <form action={changeStatus}>
          <input type="hidden" name="status" value="open" />
          <Button type="submit" variant="outline">
            Reopen task
          </Button>
        </form>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
