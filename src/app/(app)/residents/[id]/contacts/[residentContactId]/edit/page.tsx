import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { getResidentContact } from "@/lib/queries/contacts";
import { updateFamilyContactRelationship } from "@/lib/actions/resident-contacts";
import { RelationshipForm } from "../../relationship-form";

export default async function EditFamilyContactRelationshipPage({
  params,
}: {
  params: Promise<{ id: string; residentContactId: string }>;
}) {
  const { id, residentContactId } = await params;
  const [resident, residentContact] = await Promise.all([
    getResident(id),
    getResidentContact(residentContactId),
  ]);
  if (!resident || !residentContact || residentContact.resident_id !== resident.id) notFound();

  const action = updateFamilyContactRelationship.bind(null, resident.id, residentContact.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit relationship</h1>
        <p className="text-sm text-muted-foreground">
          {residentContact.contact.name}&apos;s relationship to{" "}
          {resident.preferred_name ?? resident.first_name} {resident.last_name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relationship details</CardTitle>
        </CardHeader>
        <CardContent>
          <RelationshipForm action={action} residentContact={residentContact} />
        </CardContent>
      </Card>
    </div>
  );
}
