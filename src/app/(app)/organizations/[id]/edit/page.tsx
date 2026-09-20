import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganization } from "@/lib/queries/organizations";
import { updateOrganization } from "@/lib/actions/organizations";
import { OrganizationForm } from "../../organization-form";

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const organization = await getOrganization(id);
  if (!organization) notFound();

  const action = updateOrganization.bind(null, id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit organization</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationForm action={action} organization={organization} />
        </CardContent>
      </Card>
    </div>
  );
}
