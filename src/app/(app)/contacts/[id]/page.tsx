import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorBadge } from "@/components/color-badge";
import { primaryProfileColor, primaryProfileLabel } from "@/lib/domain/primary-profile";
import { getContact, listResidentsForContact, listFacilitiesForContact } from "@/lib/queries/contacts";
import { getOrganizationForContact, listOrganizations, listOrganizationsForContact } from "@/lib/queries/organizations";
import { listFacilities } from "@/lib/queries/facilities";
import { listTasks } from "@/lib/queries/tasks";
import { TaskList } from "@/app/(app)/tasks/task-list";
import { linkContactToPlace } from "@/lib/actions/contacts";
import { LinkPlaceForm } from "./link-place-form";
import { listInteractionsForContact, listResidentsVisitedByVolunteer } from "@/lib/queries/interactions";
import { VisitPartnersCard } from "@/components/visit-partners-card";
import { setContactActive, markContactDuplicate, undoContactMerge } from "@/lib/actions/contacts";
import { getMergeInfo, contactMergeReady } from "@/lib/queries/contact-merge";
import { listContactOptions } from "@/lib/queries/contacts";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Fold } from "@/components/fold";
import { MergeContactForm } from "./merge-contact-form";
import {
  labelFor,
  PREFERRED_COMMUNICATION_METHODS,
  RESIDENT_CONTACT_RELATIONSHIPS,
  BACKGROUND_CHECK_STATUSES,
  inactiveContactLabel,
} from "@/lib/domain/contact";
import { telHref, mailtoHref, mapsHref } from "@/lib/link-helpers";
import { formatDateOnly } from "@/lib/format-date";
import { InfoRow } from "@/components/info-row";
import { InteractionRow } from "../../interactions/interaction-row";
import { CopyCheck, ListPlus, Pencil, Plus } from "lucide-react";

const BACKGROUND_CHECK_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  cleared: "success",
  pending: "warning",
  expired: "destructive",
  not_started: "secondary",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, residentLinks, facilityLinks, interactions, organizationLink, residentsVisited, organizationLinks, tasks, facilities, organizations] =
    await Promise.all([
      getContact(id),
      listResidentsForContact(id),
      listFacilitiesForContact(id),
      listInteractionsForContact(id),
      getOrganizationForContact(id),
      listResidentsVisitedByVolunteer(id),
      listOrganizationsForContact(id),
      listTasks({ contactId: id, showAllStatuses: true }),
      listFacilities(),
      listOrganizations(),
    ]);

  if (!contact) notFound();

  const [merge, profile, mergeReady] = await Promise.all([
    getMergeInfo(contact.id, contact.merged_into_id),
    getCurrentProfile(),
    contactMergeReady(),
  ]);
  const isAdmin = profile?.role === "admin";
  const canMarkDuplicate = isAdmin && mergeReady && !contact.merged_into_id;
  const mergeOptions = canMarkDuplicate
    ? (await listContactOptions())
        .filter((c) => c.id !== contact.id)
        .map((c) => ({ id: c.id, label: c.name, detail: c.detail }))
    : [];

  const toggleActive = setContactActive.bind(null, contact.id, !contact.active);
  // Places this person can be linked to: facilities and partners, in one search.
  const placeOptions = [
    ...facilities
      .filter((f) => !facilityLinks.some((l) => l.facility_id === f.id))
      .map((f) => ({ id: `facility:${f.id}`, label: f.name, detail: "Facility" })),
    ...organizations
      .filter((o) => !organizationLinks.some((l) => l.organization_id === o.id))
      .map((o) => ({ id: `organization:${o.id}`, label: o.name, detail: "Strategic Partner" })),
  ];
  // Facility staff addresses aren't shown (director, Oct 27, 2026).
  const fullAddress =
    contact.contact_type === "facility_staff"
      ? undefined
      : [contact.address, [contact.city, contact.state, contact.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || undefined;

  const primaryFacility = facilityLinks[0]
    ? { name: facilityLinks[0].facility_name, clusterId: facilityLinks[0].facility_cluster_id }
    : null;
  const primaryOrganization = organizationLink
    ? { name: organizationLink.organization_name, organizationType: organizationLink.organization_type }
    : null;
  const profileColor = primaryProfileColor(contact, primaryFacility, primaryOrganization);
  const profileLabel = primaryProfileLabel(contact, primaryFacility, primaryOrganization);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{contact.name}</h1>
            <ColorBadge color={profileColor} label={profileLabel} />
            {!contact.active ? (
              <Badge variant="outline">{inactiveContactLabel(contact.contact_type)}</Badge>
            ) : null}
          </div>
          {contact.organization ? (
            <p className="text-sm text-muted-foreground">{contact.organization}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Logging with this person starts here, with them filled in
              (Oct 27, 2026 QA); the side panel's + Log is always blank. */}
          {contact.active && !contact.merged_into_id ? (
            <Button asChild>
              <Link href={`/interactions/new?contact=${contact.id}&back=${encodeURIComponent(`/contacts/${contact.id}`)}`}>
                <Plus className="size-4" />
                Log with {contact.name}
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={`/contacts/${contact.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          {contact.merged_into_id ? null : (
            <form action={toggleActive}>
              <Button variant="outline" type="submit">
                {contact.active ? "Mark inactive" : "Mark active"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {merge.mergedInto ? (
        <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <CopyCheck className="size-4 shrink-0" />
          <span className="flex-1">
            Duplicate record, merged into{" "}
            <Link href={`/contacts/${merge.mergedInto.id}`} className="font-semibold underline">
              {merge.mergedInto.name}
            </Link>
            . Hidden from searches and lists; its history below is kept.
          </span>
          {isAdmin ? (
            <form action={undoContactMerge.bind(null, contact.id)}>
              <Button type="submit" size="sm" variant="ghost">
                Undo merge
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {merge.duplicates.length > 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Also in the CRM as a merged duplicate:{" "}
          {merge.duplicates.map((d, i) => (
            <span key={d.id}>
              {i > 0 ? ", " : null}
              <Link href={`/contacts/${d.id}`} className="underline">
                {d.name}
              </Link>
            </span>
          ))}{" "}
          (older visits and links may be there).
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <InfoRow label="Phone" value={contact.phone} href={telHref(contact.phone)} />
          <InfoRow label="Email" value={contact.email} href={mailtoHref(contact.email)} />
          <InfoRow label="Address" value={fullAddress} href={mapsHref(fullAddress)} />
          <InfoRow
            label="Preferred communication method"
            value={
              contact.preferred_communication_method
                ? labelFor(PREFERRED_COMMUNICATION_METHODS, contact.preferred_communication_method)
                : undefined
            }
          />
        </CardContent>
      </Card>

      {contact.contact_type === "volunteer" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volunteer info</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Background check</span>
              <span className="flex items-center gap-2">
                <Badge variant={BACKGROUND_CHECK_BADGE_VARIANT[contact.background_check_status]}>
                  {labelFor(BACKGROUND_CHECK_STATUSES, contact.background_check_status)}
                </Badge>
                {contact.background_check_date ? (
                  <span className="text-xs text-muted-foreground">
                    {formatDateOnly(contact.background_check_date)}
                  </span>
                ) : null}
              </span>
            </div>
            <InfoRow label="Availability" value={contact.availability_notes} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected residents</CardTitle>
        </CardHeader>
        <CardContent>
          {residentLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not linked to any residents yet. To add them as family, open the resident&apos;s page → Family →
              &ldquo;Link someone already in the CRM&rdquo;.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {residentLinks.map((link) => (
                <li key={link.resident_contact_id}>
                  <Link
                    href={`/residents/${link.resident_id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>{link.resident_name}</span>
                    <span className="flex items-center gap-2">
                      {link.is_primary_contact ? <Badge>Primary</Badge> : null}
                      <Badge variant="secondary">
                        {labelFor(RESIDENT_CONTACT_RELATIONSHIPS, link.relationship_to_resident)}
                      </Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Works at / Represents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {facilityLinks.length === 0 && organizationLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to a facility or partner yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {facilityLinks.map((link) => (
                <li key={link.facility_contact_id}>
                  <Link
                    href={`/facilities/${link.facility_id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>{link.facility_name}</span>
                    <span className="flex items-center gap-2">
                      {link.is_primary_contact ? <Badge>Primary</Badge> : null}
                      {link.role_at_facility ? (
                        <Badge variant="secondary">{link.role_at_facility}</Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
              {organizationLinks.map((link) => (
                <li key={link.organization_contact_id}>
                  <Link
                    href={`/organizations/${link.organization_id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span>{link.organization_name}</span>
                    <span className="flex items-center gap-2">
                      {link.is_primary_contact ? <Badge>Primary</Badge> : null}
                      {link.role_at_organization ? (
                        <Badge variant="secondary">{link.role_at_organization}</Badge>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {contact.merged_into_id ? null : (
            <LinkPlaceForm action={linkContactToPlace.bind(null, contact.id)} options={placeOptions} />
          )}
        </CardContent>
      </Card>

      {contact.contact_type === "volunteer" || residentsVisited.length > 0 ? (
        <VisitPartnersCard
          title="Residents visited"
          partners={residentsVisited}
          hrefBase="/residents"
          emptyMessage="No one-on-one resident visits logged for this volunteer yet."
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Interactions ({interactions.length})</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/interactions/new?contact=${contact.id}&back=${encodeURIComponent(`/contacts/${contact.id}`)}`}>
              <Plus className="size-4" />
              Log an interaction
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No interactions logged with this contact yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {interactions.map((interaction) => (
                <InteractionRow key={interaction.id} interaction={interaction} />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Fold
        title="Follow-up tasks"
        count={tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href={`/tasks/new?contact=${contact.id}`}>
              <ListPlus className="size-4" />
              Add task
            </Link>
          </Button>
        }
      >
        <TaskList tasks={tasks} returnTo={`/contacts/${contact.id}`} />
      </Fold>

      {contact.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {contact.notes}
          </CardContent>
        </Card>
      ) : null}

      {canMarkDuplicate ? (
        <Fold title="Duplicate of another record?">
          <MergeContactForm action={markContactDuplicate.bind(null, contact.id)} options={mergeOptions} name={contact.name} />
        </Fold>
      ) : null}
    </div>
  );
}
