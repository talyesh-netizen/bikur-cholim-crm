import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listResidents } from "@/lib/queries/residents";
import { listFacilities } from "@/lib/queries/facilities";
import { ResidentFilters } from "./resident-filters";
import { ResidentCard } from "./resident-card";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [residents, facilities] = await Promise.all([
    listResidents({
      search: params.search,
      facilityId: params.facility,
      status: params.status,
      showAllStatuses: params.all === "1",
    }),
    listFacilities({ showInactive: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Residents</h1>
          <p className="text-sm text-muted-foreground">
            {residents.length} resident{residents.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/residents/new">
            <Plus className="size-4" />
            Add resident
          </Link>
        </Button>
      </div>

      <ResidentFilters facilities={facilities} />

      {residents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents found"
          description="Try just a last name, or clear the filters. Residents who moved away or passed are hidden unless you choose to show all statuses."
          action={{ href: "/residents/new", label: "Add a resident" }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {residents.map((resident) => (
            <ResidentCard key={resident.id} resident={resident} />
          ))}
        </div>
      )}
    </div>
  );
}
