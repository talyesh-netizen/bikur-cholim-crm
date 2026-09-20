import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInteraction, listInteractionsForResident, listInteractionsForFacility } from "@/lib/queries/interactions";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";
import { formatDateTime } from "@/lib/format-date";
import { InteractionList } from "../interaction-list";
import { Pencil, ListPlus } from "lucide-react";

export default async function InteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interaction = await getInteraction(id);
  if (!interaction) notFound();

  const [residentInteractions, facilityInteractions] = await Promise.all([
    interaction.resident_id ? listInteractionsForResident(interaction.resident_id) : Promise.resolve([]),
    interaction.facility_id ? listInteractionsForFacility(interaction.facility_id) : Promise.resolve([]),
  ]);

  const otherResidentInteractions = residentInteractions.filter((i) => i.id !== id);
  const otherFacilityInteractions = facilityInteractions.filter((i) => i.id !== id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge>{labelFor(INTERACTION_TYPES, interaction.interaction_type)}</Badge>
            <span className="text-sm text-muted-foreground">{formatDateTime(interaction.occurred_at)}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">
            {interaction.resident_name ?? interaction.facility_name ?? "Interaction"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/tasks/new?interaction=${interaction.id}`}>
              <ListPlus className="size-4" />
              Add follow-up task
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/interactions/${interaction.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {interaction.facility_id && interaction.facility_name ? (
            <p>
              <span className="text-muted-foreground">Facility: </span>
              <Link href={`/facilities/${interaction.facility_id}`} className="font-medium hover:underline">
                {interaction.facility_name}
              </Link>
            </p>
          ) : null}
          {interaction.resident_id && interaction.resident_name ? (
            <p>
              <span className="text-muted-foreground">Resident: </span>
              <Link href={`/residents/${interaction.resident_id}`} className="font-medium hover:underline">
                {interaction.resident_name}
              </Link>
            </p>
          ) : null}
          {interaction.contact_id && interaction.contact_name ? (
            <p>
              <span className="text-muted-foreground">Contact: </span>
              <Link href={`/contacts/${interaction.contact_id}`} className="font-medium hover:underline">
                {interaction.contact_name}
              </Link>
            </p>
          ) : null}
          {interaction.staff_member_name ? (
            <p>
              <span className="text-muted-foreground">Logged by: </span>
              <span className="font-medium">{interaction.staff_member_name}</span>
            </p>
          ) : null}
          {interaction.notes ? (
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p className="whitespace-pre-wrap">{interaction.notes}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No notes were entered for this interaction.</p>
          )}
        </CardContent>
      </Card>

      {interaction.resident_id ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Other interactions with {interaction.resident_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InteractionList
              interactions={otherResidentInteractions}
              variant="resident"
              emptyMessage="No other interactions logged for this resident yet."
            />
          </CardContent>
        </Card>
      ) : null}

      {interaction.facility_id ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Other interactions at {interaction.facility_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InteractionList
              interactions={otherFacilityInteractions}
              variant="facility"
              emptyMessage="No other interactions logged at this facility yet."
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
