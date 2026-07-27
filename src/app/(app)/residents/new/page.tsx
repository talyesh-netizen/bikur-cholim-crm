import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFacilities } from "@/lib/queries/facilities";
import { createResident } from "@/lib/actions/residents";
import { ResidentForm } from "../resident-form";

export default async function NewResidentPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string }>;
}) {
  const { facility } = await searchParams;
  const facilities = await listFacilities();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a resident</h1>
        <p className="text-sm text-muted-foreground">
          Name, facility, and status are required — everything else can be
          filled in later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resident details</CardTitle>
        </CardHeader>
        <CardContent>
          <ResidentForm
            action={createResident}
            facilities={facilities}
            defaultFacilityId={facility}
          />
        </CardContent>
      </Card>
    </div>
  );
}
