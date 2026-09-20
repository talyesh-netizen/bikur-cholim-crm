import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganization } from "@/lib/queries/organizations";
import { listContactOptions } from "@/lib/queries/contacts";
import { addExistingOrganizationContact } from "@/lib/actions/organizations";
import { OrganizationContactForm } from "../organization-contact-form";

export default async function NewOrganizationContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [organization, contacts] = await Promise.all([getOrganization(id), listContactOptions()]);
  if (!organization) notFound();

  const action = addExistingOrganizationContact.bind(null, organization.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Link a contact</h1>
        <p className="text-sm text-muted-foreground">For {organization.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationContactForm action={action} contacts={contacts} />
        </CardContent>
      </Card>
    </div>
  );
}
