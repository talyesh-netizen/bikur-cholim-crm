import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFacility } from "@/lib/queries/facilities";
import { setFacilityActive } from "@/lib/actions/facilities";
import { listResidents } from "@/lib/queries/residents";
import { listInteractionsForFacility } from "@/lib/queries/interactions";
import { listFacilityContacts } from "@/lib/queries/contacts";
import { listTasksForFacility } from "@/lib/queries/tasks";
import { setFacilityContactActive, setPrimaryFacilityContact } from "@/lib/actions/facility-contacts";
import {
  labelFor,
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
  KOSHER_FOOD_OPTIONS,
} from "@/lib/domain/facility";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { ClusterBadge } from "@/components/cluster-badge";
import { labelFor as labelForContact, CONTACT_TYPES } from "@/lib/domain/contact";
import { formatDateTime } from "@/lib/format-date";
import { telHref, websiteHref, mapsHref } from "@/lib/link-helpers";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { TaskList } from "@/app/(app)/tasks/task-list";
import { InfoRow } from "@/components/info-row";
import { ClipboardCheck, Pencil, Plus, UserX, Undo2, Star, User, Mail, Phone } from "lucide-react";

export default async function FacilityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [facility, residents, interactions, facilityContacts] = await Promise.all([
    getFacility(id),
    listResidents({ facilityId: id, showAllStatuses: true }),
    listInteractionsForFacility(id),
    listFacilityContacts(id),
  ]);

  if (!facility) notFound();

  // Includes follow-ups filed against this facility's residents, not
  // just ones filed against the facility itself.
  const tasks = await listTasksForFacility(
    id,
    residents.map((resident) => resident.id),
    { includeClosed: true }
  );

  const toggleActive = setFacilityActive.bind(null, facility.id, !facility.active);
  const mainContact = facilityContacts.find((fc) => fc.is_primary_contact) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{facility.name}</h1>
            {!facility.active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {labelFor(FACILITY_TYPES, facility.facility_type)}
            {facility.city ? ` · ${facility.city}` : ""}
            {facility.geographic_cluster_name ? (
              <ClusterBadge
                clusterId={facility.geographic_cluster_id}
                name={facility.geographic_cluster_name}
              />
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={`/facilities/${facility.id}/onsite`}>
              <ClipboardCheck className="size-4" />
              Onsite mode
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/interactions/new?facility=${facility.id}`}>
              <Plus className="size-4" />
              Log an interaction
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/facilities/${facility.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <form action={toggleActive}>
            <Button variant="outline" type="submit">
              {facility.active ? "Mark inactive" : "Mark active"}
            </Button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>{labelFor(ENGAGEMENT_STATUSES, facility.engagement_status)}</Badge>
        <Badge variant="secondary">
          {labelFor(VISIT_PRIORITIES, facility.visit_priority)} priority
        </Badge>
        {facility.jewish_residents_currently_known ? (
          <Badge variant="secondary">Jewish residents known</Badge>
        ) : null}
      </div>

      {mainContact ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <User className="size-4 text-muted-foreground" />
            <Link href={`/contacts/${mainContact.contact.id}`} className="hover:underline">
              {mainContact.contact.name}
            </Link>
          </span>
          <span className="text-muted-foreground">
            {mainContact.role_at_facility || labelForContact(CONTACT_TYPES, mainContact.contact.contact_type)}
          </span>
          {mainContact.contact.phone ? (
            <a
              href={telHref(mainContact.contact.phone)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
            >
              <Phone className="size-3.5" />
              {mainContact.contact.phone}
            </a>
          ) : null}
          {mainContact.contact.email ? (
            <a
              href={`mailto:${mainContact.contact.email}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline"
            >
              <Mail className="size-3.5" />
              {mainContact.contact.email}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Address" value={formatAddress(facility)} href={mapsHref(formatAddress(facility))} />
            <InfoRow label="Main phone" value={facility.main_phone} href={telHref(facility.main_phone)} />
            <InfoRow label="Website" value={facility.website} href={websiteHref(facility.website)} />
            <InfoRow label="Parent healthcare group" value={facility.parent_healthcare_group} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jewish resident engagement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow
              label="Approx. Jewish residents"
              value={facility.approx_jewish_resident_count?.toString()}
            />
            <InfoRow
              label="Active residents on file"
              value={facility.active_resident_count.toString()}
            />
            <InfoRow
              label="Recommended visit frequency"
              value={facility.recommended_visit_frequency}
            />
            <InfoRow
              label="Kosher food availability"
              value={
                facility.kosher_food_availability
                  ? labelFor(KOSHER_FOOD_OPTIONS, facility.kosher_food_availability)
                  : undefined
              }
            />
            <InfoRow
              label="Last visit"
              value={formatDateTime(facility.last_visit_at) ?? "No visits logged yet"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Residents on file ({residents.length})</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/residents/new?facility=${facility.id}`}>
              <Plus className="size-4" />
              Add resident
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {residents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No residents on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {residents.map((resident) => (
                <li key={resident.id}>
                  <Link
                    href={`/residents/${resident.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>
                      {resident.preferred_name ?? resident.first_name} {resident.last_name}
                      {resident.room_number ? ` · Room ${resident.room_number}` : ""}
                    </span>
                    <Badge variant="secondary">{labelFor(RESIDENT_STATUSES, resident.status)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Facility contacts</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/facilities/${facility.id}/contacts/link`}>
                <Plus className="size-4" />
                Link existing contact
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/facilities/${facility.id}/contacts/new`}>
                <Plus className="size-4" />
                Add new contact
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {facilityContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No facility contacts on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {facilityContacts.map((fc) => {
                const deactivate = setFacilityContactActive.bind(null, facility.id, fc.id, false);
                const reactivate = setFacilityContactActive.bind(null, facility.id, fc.id, true);
                const makePrimary = setPrimaryFacilityContact.bind(null, facility.id, fc.id);
                return (
                  <li
                    key={fc.id}
                    className={`relative -mx-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 flex items-start justify-between gap-4 text-sm ${fc.active ? "" : "opacity-60"}`}
                  >
                    <div>
                      <Link href={`/contacts/${fc.contact.id}`} className="stretched-link font-medium hover:underline">
                        {fc.contact.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fc.role_at_facility || labelForContact(CONTACT_TYPES, fc.contact.contact_type)}
                        {fc.contact.phone ? (
                          <>
                            {" · "}
                            <a href={telHref(fc.contact.phone)} className="relative z-10 hover:underline">
                              {fc.contact.phone}
                            </a>
                          </>
                        ) : (
                          ""
                        )}
                      </p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1">
                      {!fc.active ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : fc.is_primary_contact ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <form action={makePrimary}>
                          <Button size="sm" variant="ghost" type="submit" title="Make primary contact">
                            <Star className="size-4" />
                          </Button>
                        </form>
                      )}
                      {fc.active ? (
                        <form action={deactivate}>
                          <Button size="sm" variant="ghost" type="submit" title="Deactivate">
                            <UserX className="size-4" />
                          </Button>
                        </form>
                      ) : (
                        <form action={reactivate}>
                          <Button size="sm" variant="ghost" type="submit" title="Reactivate">
                            <Undo2 className="size-4" />
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Follow-up tasks</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/tasks/new?facility=${facility.id}`}>
              <Plus className="size-4" />
              Add task
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TaskList tasks={tasks} showResident />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent interactions</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionList interactions={interactions} variant="facility" />
        </CardContent>
      </Card>

      {facility.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {facility.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatAddress(facility: { address: string | null; city: string | null; zip: string | null }) {
  const parts = [facility.address, [facility.city, facility.zip].filter(Boolean).join(" ")].filter(
    Boolean
  );
  return parts.length ? parts.join(", ") : undefined;
}
