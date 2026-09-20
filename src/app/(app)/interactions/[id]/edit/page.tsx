import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInteraction } from "@/lib/queries/interactions";
import { listFacilities } from "@/lib/queries/facilities";
import { listResidents } from "@/lib/queries/residents";
import { updateInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../../interaction-form";

/** "2026-07-28T14:30" from an ISO timestamp, for the datetime-local
 * input — see the same helper in interaction-form.tsx for why this
 * can't just be toISOString().slice(0, 16) (that would shift to UTC). */
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default async function EditInteractionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interaction = await getInteraction(id);
  if (!interaction) notFound();

  const redirectTo = interaction.resident_id
    ? `/residents/${interaction.resident_id}`
    : interaction.facility_id
      ? `/facilities/${interaction.facility_id}`
      : "/interactions";

  const [facilities, residentsAtFacility] = await Promise.all([
    listFacilities(),
    interaction.facility_id
      ? listResidents({ facilityId: interaction.facility_id, showAllStatuses: true })
      : Promise.resolve([]),
  ]);

  const action = updateInteraction.bind(null, id, redirectTo);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit interaction</h1>
        <p className="text-sm text-muted-foreground">Update the details of this logged interaction.</p>
      </div>

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
              name: `${r.preferred_name ?? r.first_name} ${r.last_name}`,
            }))}
            initialValues={{
              facility_id: interaction.facility_id ?? "",
              resident_id: interaction.resident_id ?? "",
              occurred_at: toDatetimeLocalValue(interaction.occurred_at),
              interaction_type: interaction.interaction_type,
              notes: interaction.notes ?? "",
            }}
            submitLabel="Save changes"
            savingLabel="Saving changes…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
