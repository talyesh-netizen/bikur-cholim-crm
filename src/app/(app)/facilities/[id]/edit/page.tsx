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
  const [facility, clusters] = await Promise.all([getFacility(id), listGeographicClusters()]);

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
