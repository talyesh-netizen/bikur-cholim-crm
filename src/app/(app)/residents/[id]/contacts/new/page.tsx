import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { addFamilyContact } from "@/lib/actions/resident-contacts";
import { FamilyContactForm } from "../family-contact-form";

export default async function NewFamilyContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resident = await getResident(id);
  if (!resident) notFound();

  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;
  const action = addFamilyContact.bind(null, resident.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a family contact</h1>
        <p className="text-sm text-muted-foreground">For {displayName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyContactForm action={action} />
        </CardContent>
      </Card>
    </div>
  );
}
