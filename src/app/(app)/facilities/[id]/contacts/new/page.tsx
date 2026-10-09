import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacility } from "@/lib/queries/facilities";
import { addFacilityContact } from "@/lib/actions/facility-contacts";
import { FacilityContactForm } from "../facility-contact-form";
import { onsiteHref } from "@/lib/onsite-links";

export default async function NewFacilityContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const facility = await getFacility(id);
  if (!facility) notFound();

  // Added on site: straight back to the Staff tab there.
  const action = addFacilityContact.bind(null, facility.id, from === "onsite" ? onsiteHref(facility.id, "staff") : undefined);

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
