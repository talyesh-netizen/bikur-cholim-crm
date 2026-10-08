import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listOrganizations } from "@/lib/queries/organizations";
import { OrganizationFilters } from "./organization-filters";
import { OrganizationCard } from "./organization-card";
import { SectionIcon } from "@/components/section-icon";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const organizations = await listOrganizations({
    world: "partners",
    search: params.search,
    organizationType: params.type,
    showInactive: params.all === "1",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="contacts" icon={Landmark} />
            Strategic Partners
          </h1>
          <p className="text-sm text-muted-foreground">
            Shuls, schools and Jewish organizations that partner with us · {organizations.length}
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="size-4" />
            Add partner
          </Link>
        </Button>
      </div>

      <OrganizationFilters />

      {organizations.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No organizations found"
          description="Try a shorter search or clear the filters above."
          action={{ href: "/organizations/new", label: "Add an organization" }}
        />
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
