import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacility } from "@/lib/queries/facilities";
import { addFacilityContact } from "@/lib/actions/facility-contacts";
import { FacilityContactForm } from "../facility-contact-form";

export default async function NewFacilityContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const facility = await getFacility(id);
  if (!facility) notFound();

  const action = addFacilityContact.bind(null, facility.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a facility contact</h1>
        <p className="text-sm text-muted-foreground">For {facility.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <FacilityContactForm action={action} />
        </CardContent>
      </Card>
    </div>
  );
}
