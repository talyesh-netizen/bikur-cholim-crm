import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChainNav } from "@/components/chain-nav";
import { EmptyState } from "@/components/empty-state";
import { facilityCountsByGroup, listOrganizations } from "@/lib/queries/organizations";

/** Healthcare groups: the companies that own the facilities we serve
 * (plus hospice / home care providers) -- the top of the chain
 * Group > Facility > Residents > Family. */
export default async function HealthcareGroupsPage() {
  const [groups, counts] = await Promise.all([listOrganizations({ world: "healthcare" }), facilityCountsByGroup()]);
  const withCounts = groups
    .map((g) => ({ ...g, facilities: counts.get(g.name.trim().toLowerCase()) ?? 0 }))
    .sort((a, b) => b.facilities - a.facilities || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <ChainNav steps={[{ label: "Facilities", href: "/facilities" }, { label: "Healthcare groups" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Healthcare groups</h1>
          <p className="text-sm text-muted-foreground">The companies that own the facilities we serve · {groups.length}</p>
        </div>
        <Button asChild>
          <Link href="/organizations/new?type=healthcare_group">
            <Plus className="size-4" />
            Add group
          </Link>
        </Button>
      </div>

      {withCounts.length === 0 ? (
        <EmptyState icon={Building2} title="No healthcare groups yet" description="Add the companies that own the facilities you visit." />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {withCounts.map((g) => (
            <li key={g.id}>
              <Link href={`/facilities/groups/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{g.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {g.facilities > 0 ? `${g.facilities} facilit${g.facilities === 1 ? "y" : "ies"}` : "Care provider · no facilities linked"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
