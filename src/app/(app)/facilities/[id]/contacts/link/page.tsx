import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFacility } from "@/lib/queries/facilities";
import { listContactOptions } from "@/lib/queries/contacts";
import { addExistingFacilityContact } from "@/lib/actions/facility-contacts";
import { LinkExistingContactForm } from "../link-existing-contact-form";

export default async function LinkFacilityContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [facility, contacts] = await Promise.all([getFacility(id), listContactOptions()]);
  if (!facility) notFound();

  const action = addExistingFacilityContact.bind(null, facility.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Link a contact</h1>
        <p className="text-sm text-muted-foreground">For {facility.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkExistingContactForm action={action} contacts={contacts} />
        </CardContent>
      </Card>
    </div>
  );
}
