import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listGeographicClusters } from "@/lib/queries/facilities";
import { createFacility } from "@/lib/actions/facilities";
import { FacilityForm } from "../facility-form";

export default async function NewFacilityPage() {
  const clusters = await listGeographicClusters();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a facility</h1>
        <p className="text-sm text-muted-foreground">
          Only the name and facility type are required — everything else can
          be filled in later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility details</CardTitle>
        </CardHeader>
        <CardContent>
          <FacilityForm action={createFacility} clusters={clusters} />
        </CardContent>
      </Card>
    </div>
  );
}
