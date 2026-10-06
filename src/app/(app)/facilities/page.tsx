import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { listFacilities, listGeographicClusters } from "@/lib/queries/facilities";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { FacilityFilters } from "./facility-filters";
import { FacilityCard } from "./facility-card";
import { SectionIcon } from "@/components/section-icon";

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getCurrentProfile();

  const [facilities, clusters] = await Promise.all([
    listFacilities({
      search: params.search,
      clusterId: params.cluster,
      engagementStatus: params.engagement,
      visitPriority: params.priority,
      facilityType: params.type,
      showInactive: params.inactive === "1",
      withResidents: params.residents === "1",
    }),
    listGeographicClusters(true),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="facilities" icon={Building2} />
            Facilities
          </h1>
          <p className="text-sm text-muted-foreground">
            {facilities.length} facilit{facilities.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex gap-2">
          {profile?.role === "admin" ? (
            <Button variant="outline" asChild>
              <Link href="/settings/clusters">
                <Settings className="size-4" />
                Manage clusters
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/facilities/new">
              <Plus className="size-4" />
              Add facility
            </Link>
          </Button>
        </div>
      </div>

      <FacilityFilters clusters={clusters} />

      {facilities.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No facilities found"
          description="Try a shorter search or clear the filters above."
          action={{ href: "/facilities/new", label: "Add a facility" }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {facilities.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      )}
    </div>
  );
}
