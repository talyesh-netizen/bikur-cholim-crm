import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listInteractions } from "@/lib/queries/interactions";
import { listFacilityOptions } from "@/lib/queries/facilities";
import { listActiveStaff } from "@/lib/queries/profiles";
import { InteractionFilters } from "./interaction-filters";
import { InteractionRow } from "./interaction-row";
import { SectionIcon } from "@/components/section-icon";
import { FAMILY_NEEDS, HOLIDAYS, INTERACTION_TYPES, labelFor } from "@/lib/domain/interaction";
import { formatDateOnly } from "@/lib/format-date";

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  // Set by the Impact page's tiles and bars ("see the entries behind
  // this number"); unknown values are ignored rather than trusted.
  const types = (params.types ?? "").split(",").filter((t) => INTERACTION_TYPES.some((x) => x.value === t));
  const holiday = HOLIDAYS.find((h) => h.value === params.holiday);
  const need = FAMILY_NEEDS.find((f) => f.value === params.need);
  const showing = [
    types.length ? types.map((t) => labelFor(INTERACTION_TYPES, t)).join(", ") : null,
    holiday ? `For ${holiday.label}` : null,
    need ? `Family need: ${need.label}` : null,
  ].filter(Boolean);

  const [{ interactions, totalCount, pageSize }, facilities, staff] = await Promise.all([
    listInteractions({
      interactionType: params.type,
      facilityId: params.facility,
      staffId: params.staff,
      dateFrom: params.from,
      dateTo: params.to,
      search: params.search,
      flag: params.flag === "funder_story" || params.flag === "unmet_need" ? params.flag : undefined,
      interactionTypes: types,
      holiday: holiday?.value,
      familyNeed: need?.value,
    }),
    listFacilityOptions(),
    listActiveStaff(),
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

      <InteractionFilters facilities={facilities} staff={staff} />

      {showing.length ? (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span>
            <span className="text-muted-foreground">Showing: </span>
            {showing.join(" · ")}
            {params.from ? <span className="text-muted-foreground"> · since {formatDateOnly(params.from)}</span> : null}
            {params.to ? <span className="text-muted-foreground"> · to {formatDateOnly(params.to)}</span> : null}
          </span>
          <Link href="/interactions" className="font-medium underline underline-offset-2">
            Show all
          </Link>
        </p>
      ) : null}

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
