import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { getFacility, listFacilities } from "@/lib/queries/facilities";
import { getInteraction } from "@/lib/queries/interactions";
import { listActiveStaff } from "@/lib/queries/profiles";
import { createTask } from "@/lib/actions/tasks";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { TaskForm } from "../task-form";
import { residentName } from "@/lib/domain/resident-name";
import { getCurrentProfile } from "@/lib/get-current-profile";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string; interaction?: string; from?: string }>;
}) {
  const { resident: residentId, facility: facilityId, interaction: interactionId, from } =
    await searchParams;

  const [staff, facilities, resident, facility, interaction, me] = await Promise.all([
    listActiveStaff(),
    listFacilities(),
    residentId ? getResident(residentId) : Promise.resolve(null),
    facilityId ? getFacility(facilityId) : Promise.resolve(null),
    interactionId ? getInteraction(interactionId) : Promise.resolve(null),
    getCurrentProfile(),
  ]);

  if (residentId && !resident) notFound();
  if (facilityId && !facility) notFound();
  if (interactionId && !interaction) notFound();

  // Opened from on-site mode: go back there, not to the resident page.
  const redirectTo = from === "onsite" && facilityId
    ? `/facilities/${facilityId}/onsite`
    : residentId
    ? `/residents/${residentId}`
    : facilityId
      ? `/facilities/${facilityId}`
      : "/tasks";
  const action = createTask.bind(null, redirectTo);

  let fixedContext:
    | { label: string; residentId?: string; facilityId?: string; interactionId?: string }
    | undefined;

  if (interaction) {
    fixedContext = {
      label: `${labelFor(INTERACTION_TYPES, interaction.interaction_type)}${
        interaction.resident_name ? ` — ${interaction.resident_name}` : ""
      }`,
      interactionId: interaction.id,
      residentId: interaction.resident_id ?? undefined,
      facilityId: interaction.facility_id ?? undefined,
    };
  } else if (resident) {
    fixedContext = {
      label: residentName(resident),
      residentId: resident.id,
    };
  } else if (facility) {
    fixedContext = { label: facility.name, facilityId: facility.id };
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a follow-up task</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task details</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm
            action={action}
            staff={staff}
            facilities={facilities}
            fixedContext={fixedContext}
            defaultAssigneeId={staff.some((s) => s.id === me?.id) ? me?.id : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
