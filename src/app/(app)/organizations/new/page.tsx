import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization } from "@/lib/actions/organizations";
import { OrganizationForm } from "../organization-form";

export default function NewOrganizationPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add an organization</h1>
        <p className="text-sm text-muted-foreground">
          A synagogue, school, or other community partner organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationForm action={createOrganization} />
        </CardContent>
      </Card>
    </div>
  );
}
