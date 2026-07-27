import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { updateResident } from "@/lib/actions/residents";
import { ResidentForm } from "../../resident-form";

export default async function EditResidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resident = await getResident(id);

  if (!resident) notFound();

  const action = updateResident.bind(null, resident.id);
  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit {displayName}</h1>
        <p className="text-sm text-muted-foreground">
          To move this resident to a different facility, use{" "}
          <span className="font-medium">Move to another facility</span> on their
          profile instead — that keeps their history intact.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resident details</CardTitle>
        </CardHeader>
        <CardContent>
          <ResidentForm action={action} resident={resident} />
        </CardContent>
      </Card>
    </div>
  );
}
