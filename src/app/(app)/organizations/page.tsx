import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listOrganizations } from "@/lib/queries/organizations";
import { OrganizationFilters } from "./organization-filters";
import { OrganizationCard } from "./organization-card";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const organizations = await listOrganizations({
    search: params.search,
    organizationType: params.type,
    showInactive: params.all === "1",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shuls & Partners</h1>
          <p className="text-sm text-muted-foreground">
            {organizations.length} organization{organizations.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="size-4" />
            Add organization
          </Link>
        </Button>
      </div>

      <OrganizationFilters />

      {organizations.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No organizations match your search. Try adjusting the filters above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {organizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      )}
    </div>
  );
}
