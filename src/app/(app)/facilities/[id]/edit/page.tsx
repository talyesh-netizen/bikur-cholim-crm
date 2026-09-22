import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacility, listGeographicClusters } from "@/lib/queries/facilities";
import { updateFacility } from "@/lib/actions/facilities";
import { FacilityForm } from "../../facility-form";

export default async function EditFacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // includeInactive: a facility already assigned to a retired cluster
  // needs that cluster in the picker's options, or it would silently
  // render as "No cluster assigned" even though one is still set (the
  // active-only list is only meant to hide retired clusters when
  // choosing a *new* one -- see the migration comment on the cluster's
  // active column).
  const [facility, clusters] = await Promise.all([getFacility(id), listGeographicClusters(true)]);

  if (!facility) notFound();

  const action = updateFacility.bind(null, facility.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit {facility.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility details</CardTitle>
        </CardHeader>
        <CardContent>
          <FacilityForm action={action} clusters={clusters} facility={facility} />
        </CardContent>
      </Card>
    </div>
  );
}
