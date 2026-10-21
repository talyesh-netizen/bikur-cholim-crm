import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { listContactOptions } from "@/lib/queries/contacts";
import { linkExistingFamilyContact } from "@/lib/actions/resident-contacts";
import { RelationshipForm } from "../relationship-form";
import { residentName } from "@/lib/domain/resident-name";

/** Link someone already in the CRM to this resident as family. */
export default async function LinkFamilyContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contact?: string }>;
}) {
  const { id } = await params;
  const { contact } = await searchParams;
  const [resident, contacts] = await Promise.all([getResident(id), listContactOptions()]);
  if (!resident) notFound();

  const action = linkExistingFamilyContact.bind(null, resident.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Link family already in the CRM</h1>
        <p className="text-sm text-muted-foreground">For {residentName(resident)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who they are to {residentName(resident)}</CardTitle>
        </CardHeader>
        <CardContent>
          <RelationshipForm
            action={action}
            link={{
              contacts,
              defaultContactId: contacts.some((c) => c.id === contact) ? contact : undefined,
              addNewHref: `/residents/${resident.id}/contacts/new`,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
