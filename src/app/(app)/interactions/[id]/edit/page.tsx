import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { getInteraction, getInteractionVolunteerIds } from "@/lib/queries/interactions";
import { listFacilities } from "@/lib/queries/facilities";
import { residentOptions } from "@/lib/resident-options";
import { listContactOptions, listContactsByIds } from "@/lib/queries/contacts";
import { updateInteraction } from "@/lib/actions/interactions";
import { InteractionForm } from "../../interaction-form";
import { orgDayKey } from "@/lib/format-date";
import { onsiteHref } from "@/lib/onsite-links";
import { getActivityExtras, getActivityFormOptions } from "@/lib/queries/activity";
import { ENGAGEMENT_TYPES } from "@/lib/domain/interaction";

export default async function EditInteractionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ volunteersError?: string; peopleError?: string; from?: string }>;
}) {
  const { id } = await params;
  const { volunteersError, peopleError, from } = await searchParams;
  const interaction = await getInteraction(id);
  if (!interaction) notFound();

  // Fixed from on-site mode's Today list: back to that list.
  const redirectTo = (from === "onsite" ? onsiteHref(interaction.facility_id, "today") : undefined) ?? (interaction.resident_id
    ? `/residents/${interaction.resident_id}`
    : interaction.facility_id
      ? `/facilities/${interaction.facility_id}`
      : "/interactions");

  const [facilities, residents, contacts, activeVolunteers, volunteerIds, activity, extras] = await Promise.all([
    listFacilities(),
    residentOptions(interaction.resident_id),
    listContactOptions(),
    listContactOptions("volunteer"),
    getInteractionVolunteerIds(id),
    getActivityFormOptions(),
    getActivityExtras(id),
  ]);

  // Who did it, as saved: the lead first, then the team. Staff engaged:
  // a staff entry's own contact counts as engaged, as it always has.
  const engaged = [
    ...(ENGAGEMENT_TYPES.includes(interaction.interaction_type) && interaction.contact_id ? [interaction.contact_id] : []),
    ...extras.engaged.map((c) => c.id),
  ];
  const initialPeople = {
    doneBy: [interaction.staff_member_id, ...extras.team.map((t) => t.id).filter((tid) => tid !== interaction.staff_member_id)],
    engaged: [...new Set(engaged)],
    present: extras.present.map((c) => c.id),
  };
  const initialPartOf = extras.partOf
    ? {
        id: extras.partOf.id,
        occurred_at: extras.partOf.occurred_at,
        partner_organization_id: extras.partner?.id ?? "",
        partner_name: extras.partner?.name ?? "the group",
        participants: extras.partOf.participants ?? 0,
        facility_name: extras.partOf.facility_name,
      }
    : null;

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

      {peopleError ? (
        <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          <span>This entry was saved, but who did it and the staff linked couldn&apos;t be recorded. Please check them below and save again.</span>
        </div>
      ) : null}

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
            residents={residents}
            contacts={contacts}
            volunteers={volunteers}
            initialVolunteerIds={volunteerIds}
            activity={activity}
            initialPeople={initialPeople}
            initialPartOf={initialPartOf}
            selfId={id}
            initialValues={{
              facility_id: interaction.facility_id ?? "",
              resident_id: interaction.resident_id ?? "",
              contact_id: interaction.contact_id ?? "",
              occurred_at: orgDayKey(interaction.occurred_at),
              occurred_at_saved: interaction.occurred_at,
              interaction_type: interaction.interaction_type,
              notes: interaction.notes ?? "",
              partner_organization_id: extras.partner?.id ?? "",
              occasion: interaction.occasion ?? "",
              holiday: interaction.holiday ?? "",
              family_need: interaction.family_need ?? "",
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
