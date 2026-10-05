import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFacilities } from "@/lib/queries/facilities";
import { createResident } from "@/lib/actions/residents";
import { ResidentForm } from "../resident-form";
import { getCurrentProfile } from "@/lib/get-current-profile";

export default async function NewResidentPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string }>;
}) {
  const { facility } = await searchParams;
  const [facilities, profile] = await Promise.all([listFacilities(), getCurrentProfile()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a resident</h1>
        <p className="text-sm text-muted-foreground">
          Name and status are required — everything else can be filled in
          later. Leave the facility blank if their current location is unknown.
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
            showPrivateNotes={profile?.role !== "intern"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
