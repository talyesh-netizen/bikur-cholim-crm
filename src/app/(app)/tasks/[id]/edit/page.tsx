import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTask } from "@/lib/queries/tasks";
import { listActiveStaff } from "@/lib/queries/profiles";
import { listFacilities } from "@/lib/queries/facilities";
import { updateTask } from "@/lib/actions/tasks";
import { TaskForm } from "../../task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [task, staff, facilities] = await Promise.all([
    getTask(id),
    listActiveStaff(),
    listFacilities(),
  ]);
  if (!task) notFound();

  const action = updateTask.bind(null, task.id, `/tasks/${task.id}`);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit task</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task details</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm action={action} task={task} staff={staff} facilities={facilities} />
        </CardContent>
      </Card>
    </div>
  );
}
