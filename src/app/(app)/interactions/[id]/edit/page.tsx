import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { getInteraction, getInteractionVolunteerIds } from "@/lib/queries/interactions";
import { listFacilities } from "@/lib/queries/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listContactOptions, listContactsByIds } from "@/lib/queries/contacts";
import { updateInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../../interaction-form";
import { toOrgDatetimeLocalValue } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";

export default async function EditInteractionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volunteersError?: string }>;
}) {
  const { id } = await params;
  const { volunteersError } = await searchParams;
  const interaction = await getInteraction(id);
  if (!interaction) notFound();

  const redirectTo = interaction.resident_id
    ? `/residents/${interaction.resident_id}`
    : interaction.facility_id
      ? `/facilities/${interaction.facility_id}`
      : "/interactions";

  const [facilities, residentsAtFacility, contacts, activeVolunteers, volunteerIds] = await Promise.all([
    listFacilities(),
    interaction.facility_id
      ? listResidents({ facilityId: interaction.facility_id, showAllStatuses: true })
      : Promise.resolve([]),
    listContactOptions(),
    listContactOptions("volunteer"),
    getInteractionVolunteerIds(id),
  ]);

  // A volunteer already linked to this interaction might since have gone
  // inactive, which would drop them from the checkbox list above (and
  // silently unlink them on save) -- add them back in, so re-saving this
  // form for an unrelated reason (e.g. fixing a typo in the notes) can't
  // quietly lose them.
  const missingVolunteerIds = volunteerIds.filter((vid) => !activeVolunteers.some((v) => v.id === vid));
  const missingVolunteers = await listContactsByIds(missingVolunteerIds);
  const volunteers = [
    ...activeVolunteers,
    ...missingVolunteers.map((v) => ({ id: v.id, name: `${v.name} (inactive)` })),
  ];

  const action = updateInteraction.bind(null, id, redirectTo);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit interaction</h1>
        <p className="text-sm text-muted-foreground">Update the details of this logged interaction.</p>
      </div>

      {volunteersError ? (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            This interaction was saved, but the volunteers involved couldn&apos;t be recorded. Please check
            them below and save again.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interaction details</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionForm
            action={action}
            facilities={facilities}
            residents={residentsAtFacility.map((r) => ({
              id: r.id,
              name: residentName(r),
            }))}
            contacts={contacts}
            volunteers={volunteers}
            initialVolunteerIds={volunteerIds}
            initialValues={{
              facility_id: interaction.facility_id ?? "",
              resident_id: interaction.resident_id ?? "",
              contact_id: interaction.contact_id ?? "",
              occurred_at: toOrgDatetimeLocalValue(interaction.occurred_at),
              interaction_type: interaction.interaction_type,
              notes: interaction.notes ?? "",
              occasion: interaction.occasion ?? "",
              program_partner: interaction.program_partner ?? "",
              quantity: interaction.quantity?.toString() ?? "",
              people_reached: interaction.people_reached?.toString() ?? "",
              participants: interaction.participants?.toString() ?? "",
              minutes_spent: interaction.minutes_spent?.toString() ?? "",
              unmet_need: interaction.unmet_need ? "on" : "",
              unmet_need_reason: interaction.unmet_need_reason ?? "",
              funder_story: interaction.funder_story ? "on" : "",
            }}
            submitLabel="Save changes"
            savingLabel="Saving changes…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
