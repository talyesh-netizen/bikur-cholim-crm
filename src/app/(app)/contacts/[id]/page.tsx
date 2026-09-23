import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorBadge } from "@/components/color-badge";
import { primaryProfileColor, primaryProfileLabel } from "@/lib/domain/primary-profile";
import { getContact, listResidentsForContact, listFacilitiesForContact } from "@/lib/queries/contacts";
import { getOrganizationForContact } from "@/lib/queries/organizations";
import { listInteractionsForContact, listResidentsVisitedByVolunteer } from "@/lib/queries/interactions";
import { VisitPartnersCard } from "@/components/visit-partners-card";
import { setContactActive } from "@/lib/actions/contacts";
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
import { Pencil, Plus } from "lucide-react";

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
  const [contact, residentLinks, facilityLinks, interactions, organizationLink, residentsVisited] = await Promise.all([
    getContact(id),
    listResidentsForContact(id),
    listFacilitiesForContact(id),
    listInteractionsForContact(id),
    getOrganizationForContact(id),
    listResidentsVisitedByVolunteer(id),
  ]);

  if (!contact) notFound();

  const toggleActive = setContactActive.bind(null, contact.id, !contact.active);
  const fullAddress =
    [contact.address, [contact.city, contact.state, contact.zip].filter(Boolean).join(" ")]
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
          <Button variant="outline" asChild>
            <Link href={`/contacts/${contact.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <form action={toggleActive}>
            <Button variant="outline" type="submit">
              {contact.active ? "Mark inactive" : "Mark active"}
            </Button>
          </form>
        </div>
      </div>

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

      {organizationLink ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/organizations/${organizationLink.organization_id}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span>{organizationLink.organization_name}</span>
              {organizationLink.role_at_organization ? (
                <Badge variant="secondary">{organizationLink.role_at_organization}</Badge>
              ) : null}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected residents</CardTitle>
        </CardHeader>
        <CardContent>
          {residentLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any residents yet.</p>
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
          <CardTitle className="text-base">Connected facilities</CardTitle>
        </CardHeader>
        <CardContent>
          {facilityLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any facilities yet.</p>
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
            </ul>
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
            <Link href="/interactions/new">
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
    </div>
  );
}

