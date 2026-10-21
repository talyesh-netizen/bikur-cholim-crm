import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInteraction, listInteractionsForResident, listInteractionsForFacility } from "@/lib/queries/interactions";
import {
  labelFor,
  formatMinutes,
  INTERACTION_TYPES,
  OCCASIONS,
  HOLIDAYS,
  FAMILY_NEEDS,
  PROGRAM_PARTNERS,
  UNMET_NEED_REASONS,
  IN_PERSON_ONLY_TYPES,
} from "@/lib/domain/interaction";
import { formatDateTime, formatDateTimeWithTime } from "@/lib/format-date";
import { InteractionList, staffLabel } from "../interaction-list";
import { ClusterBadge } from "@/components/cluster-badge";
import { Pencil, ListPlus } from "lucide-react";
import { getActivityExtras } from "@/lib/queries/activity";
import { STAFF_SUPPORT_TYPES } from "@/lib/queries/report-rules";

export default async function InteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const interaction = await getInteraction(id);
  if (!interaction) notFound();

  const [residentInteractions, facilityInteractions, extras] = await Promise.all([
    interaction.resident_id ? listInteractionsForResident(interaction.resident_id) : Promise.resolve([]),
    interaction.facility_id ? listInteractionsForFacility(interaction.facility_id) : Promise.resolve([]),
    getActivityExtras(id),
  ]);
  const doneBy = [
    ...(interaction.staff_member_name ? [{ id: interaction.staff_member_id, name: interaction.staff_member_name }] : []),
    ...extras.team.filter((t) => t.id !== interaction.staff_member_id),
  ];
  // A staff call or meeting (including one saved on the on-site screen)
  // names its person as the entry's contact; that person was spoken
  // with and counts as engaged, so show them that way.
  const staffContact =
    STAFF_SUPPORT_TYPES.has(interaction.interaction_type) && interaction.contact_id && interaction.contact_name
      ? { id: interaction.contact_id, name: interaction.contact_name }
      : null;
  const engaged =
    staffContact && !extras.engaged.some((c) => c.id === staffContact.id)
      ? [staffContact, ...extras.engaged]
      : extras.engaged;

  const serviceDetails = [
    interaction.program_partner ? { label: "School or shul", value: labelFor(PROGRAM_PARTNERS, interaction.program_partner) } : null,
    interaction.holiday ? { label: "Holiday", value: labelFor(HOLIDAYS, interaction.holiday) } : null,
    interaction.family_need ? { label: "What the family needed", value: labelFor(FAMILY_NEEDS, interaction.family_need) } : null,
    interaction.occasion ? { label: "Occasion", value: labelFor(OCCASIONS, interaction.occasion) } : null,
    interaction.quantity != null ? { label: "Items", value: String(interaction.quantity) } : null,
    interaction.participants != null
      ? {
          label: extras.partner ? `Volunteers from ${extras.partner.name}` : "Participants",
          value: extras.projectMembers.length > 0
            ? `about ${interaction.participants} (counted once for the whole project)`
            : `about ${interaction.participants}`,
        }
      : null,
    interaction.people_reached != null ? { label: "Residents reached", value: `about ${interaction.people_reached}` } : null,
    interaction.minutes_spent != null ? { label: "Time spent", value: formatMinutes(interaction.minutes_spent) } : null,
  ].filter((d): d is { label: string; value: string } => d !== null);

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
            <Link href={`/interactions/${interaction.id}/edit?back=${encodeURIComponent(`/interactions/${interaction.id}`)}`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {extras.countedIn ? (
        <div role="note" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Reviewed as a double entry: this is counted once, in{" "}
          <Link href={`/interactions/${extras.countedIn.id}`} className="font-semibold underline">
            the entry from {formatDateTime(extras.countedIn.occurred_at)}
          </Link>
          . This copy is kept for the record, and the staff member on it is credited on that entry.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {interaction.facility_id && interaction.facility_name ? (
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Facility: </span>
              <Link href={`/facilities/${interaction.facility_id}`} className="hover:underline">
                <ClusterBadge clusterId={interaction.facility_cluster_id} name={interaction.facility_name} />
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
          {interaction.interaction_type === "volunteer_visit" ? (
            <p>
              <span className="text-muted-foreground">
                Volunteer{interaction.volunteers.length === 1 ? "" : "s"}:{" "}
              </span>
              {interaction.volunteers.length > 0 ? (
                interaction.volunteers.map((v, i) => (
                  <span key={v.id}>
                    <Link href={`/contacts/${v.id}`} className="font-medium hover:underline">
                      {v.name}
                    </Link>
                    {i < interaction.volunteers.length - 1 ? ", " : ""}
                  </span>
                ))
              ) : (
                <span className="font-medium text-warning">Not tagged yet</span>
              )}
            </p>
          ) : interaction.contact_id && interaction.contact_name && engaged.length === 0 ? (
            <p>
              <span className="text-muted-foreground">Contact: </span>
              <Link href={`/contacts/${interaction.contact_id}`} className="font-medium hover:underline">
                {interaction.contact_name}
              </Link>
            </p>
          ) : null}
          {extras.partner ? (
            <p>
              <span className="text-muted-foreground">Partner: </span>
              <Link href={`/organizations/${extras.partner.id}`} className="font-medium hover:underline">
                {extras.partner.name}
              </Link>
            </p>
          ) : null}
          {extras.partOf ? (
            <p>
              <span className="text-muted-foreground">Part of: </span>
              <Link href={`/interactions/${extras.partOf.id}`} className="font-medium hover:underline">
                the project&apos;s first activity, {formatDateTime(extras.partOf.occurred_at)}
                {extras.partOf.facility_name ? ` at ${extras.partOf.facility_name}` : ""}
              </Link>
              {extras.partOf.participants ? (
                <span className="text-muted-foreground"> — its {extras.partOf.participants} volunteers are counted there</span>
              ) : null}
            </p>
          ) : null}
          {extras.projectMembers.length > 0 ? (
            <div>
              <p className="text-muted-foreground">Also part of this project (volunteers counted here, once):</p>
              <ul className="ml-4 list-disc">
                {extras.projectMembers.map((m) => (
                  <li key={m.id}>
                    <Link href={`/interactions/${m.id}`} className="hover:underline">
                      {formatDateTime(m.occurred_at)}
                      {m.facility_name ? ` · ${m.facility_name}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {engaged.length > 0 ? (
            <p>
              <span className="text-muted-foreground">Staff worked with or spoke to: </span>
              {engaged.map((c, i) => (
                <span key={c.id}>
                  <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                  {i < engaged.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          ) : null}
          {extras.present.length > 0 ? (
            <p>
              <span className="text-muted-foreground">Also there (not counted): </span>
              {extras.present.map((c, i) => (
                <span key={c.id}>
                  <Link href={`/contacts/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                  {i < extras.present.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          ) : null}
          {serviceDetails.map((d) => (
            <p key={d.label}>
              <span className="text-muted-foreground">{d.label}: </span>
              <span className="font-medium">{d.value}</span>
            </p>
          ))}
          {interaction.unmet_need ? (
            <p>
              <Badge variant="warning">Couldn&apos;t fully meet this request</Badge>{" "}
              {interaction.unmet_need_reason ? (
                <span className="text-muted-foreground">
                  {labelFor(UNMET_NEED_REASONS, interaction.unmet_need_reason)}
                </span>
              ) : null}
            </p>
          ) : null}
          {IN_PERSON_ONLY_TYPES.includes(interaction.interaction_type) ? (
            <p className="text-muted-foreground">
              {interaction.in_person ? "In person at the facility (counts as a facility visit-day)" : "Not marked in person (a call, email or not recorded)"}
            </p>
          ) : null}
          {interaction.funder_story ? (
            <p>
              <Badge variant="secondary">Good story for funders</Badge>
            </p>
          ) : null}
          {doneBy.length > 0 ? (
            <p>
              <span className="text-muted-foreground">
                {doneBy.length > 1 ? "Done by" : staffLabel(interaction.interaction_type)}:{" "}
              </span>
              <span className="font-medium">{doneBy.map((d) => d.name).join(", ")}</span>
              {extras.enteredBy && extras.enteredBy.id !== interaction.staff_member_id ? (
                <span className="text-muted-foreground"> · entered by {extras.enteredBy.name}</span>
              ) : null}
            </p>
          ) : null}
          {/* The visit's own day is shown above; when it was typed in
              is kept for the record. */}
          <p className="text-xs text-muted-foreground">Entered {formatDateTimeWithTime(interaction.created_at)}</p>
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
