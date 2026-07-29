import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { getFacility, listFacilities } from "@/lib/queries/facilities";
import { listResidents } from "@/lib/queries/residents";
import { createInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../interaction-form";

export default async function NewInteractionPage({
  searchParams,
}: {
  searchParams: Promise<{ resident?: string; facility?: string }>;
}) {
  const { resident: residentId, facility: facilityId } = await searchParams;

  const [facilities, resident, residentsAtFacility] = await Promise.all([
    listFacilities(),
    residentId ? getResident(residentId) : Promise.resolve(null),
    !residentId && facilityId
      ? listResidents({ facilityId, showAllStatuses: true })
      : Promise.resolve([]),
  ]);

  if (residentId && !resident) notFound();
  if (facilityId) {
    const facility = await getFacility(facilityId);
    if (!facility) notFound();
  }

  const redirectTo = residentId
    ? `/residents/${residentId}`
    : facilityId
      ? `/facilities/${facilityId}`
      : "/dashboard";
  const action = createInteraction.bind(null, redirectTo);

  const fixedResident = resident
    ? {
        id: resident.id,
        name: `${resident.preferred_name ?? resident.first_name} ${resident.last_name}`,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Log an interaction</h1>
        <p className="text-sm text-muted-foreground">
          Quickly record a visit, call, or other activity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interaction details</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionForm
            action={action}
            facilities={facilities}
            defaultFacilityId={facilityId ?? resident?.current_facility_id}
            fixedResident={fixedResident}
            residents={residentsAtFacility.map((r) => ({
              id: r.id,
              name: `${r.preferred_name ?? r.first_name} ${r.last_name}`,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
