import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";
import { listFacilities, listGeographicClusters } from "@/lib/queries/facilities";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { FacilityFilters } from "./facility-filters";
import { FacilityCard } from "./facility-card";

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
    }),
    listGeographicClusters(true),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Facilities</h1>
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          No facilities match your search. Try adjusting the filters above.
        </p>
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
