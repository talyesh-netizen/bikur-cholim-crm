import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listInteractions } from "@/lib/queries/interactions";
import { listFacilityOptions } from "@/lib/queries/facilities";
import { InteractionFilters } from "./interaction-filters";
import { InteractionRow } from "./interaction-row";
import { SectionIcon } from "@/components/section-icon";

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [{ interactions, totalCount, pageSize }, facilities] = await Promise.all([
    listInteractions({
      interactionType: params.type,
      facilityId: params.facility,
      dateFrom: params.from,
      dateTo: params.to,
      search: params.search,
      flag: params.flag === "funder_story" || params.flag === "unmet_need" ? params.flag : undefined,
    }),
    listFacilityOptions(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            <SectionIcon section="log" icon={History} />
            Interactions
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} interaction{totalCount === 1 ? "" : "s"}
            {totalCount > pageSize ? ` · showing the most recent ${pageSize}` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/interactions/new">
            <Plus className="size-4" />
            Log interaction
          </Link>
        </Button>
      </div>

      <InteractionFilters facilities={facilities} />

      {interactions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No interactions found"
          description="Try a different type, facility, or date range, or clear the filters above."
          action={{ href: "/interactions/new?type=resident_visit", label: "Log a visit" }}
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {interactions.map((interaction) => (
            <InteractionRow key={interaction.id} interaction={interaction} />
          ))}
        </ol>
      )}

      {totalCount > pageSize ? (
        <p className="text-center text-xs text-muted-foreground">
          Narrow with the filters above to find older interactions.
        </p>
      ) : null}
    </div>
  );
}
