import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganization } from "@/lib/actions/organizations";
import { HEALTHCARE_GROUP } from "@/lib/domain/organization";
import { OrganizationForm } from "../organization-form";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const healthcare = type === HEALTHCARE_GROUP;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{healthcare ? "Add a healthcare group" : "Add a strategic partner"}</h1>
        <p className="text-sm text-muted-foreground">
          {healthcare
            ? "A company that owns or runs facilities we serve, or a hospice / home care provider."
            : "A shul, school or Jewish organization that partners with us."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationForm action={createOrganization} defaultType={healthcare ? HEALTHCARE_GROUP : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
