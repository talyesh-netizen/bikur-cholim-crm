import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getContact, listResidentsForContact, listFacilitiesForContact } from "@/lib/queries/contacts";
import { setContactActive } from "@/lib/actions/contacts";
import { labelFor, CONTACT_TYPES, PREFERRED_COMMUNICATION_METHODS, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { Pencil } from "lucide-react";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [contact, residentLinks, facilityLinks] = await Promise.all([
    getContact(id),
    listResidentsForContact(id),
    listFacilitiesForContact(id),
  ]);

  if (!contact) notFound();

  const toggleActive = setContactActive.bind(null, contact.id, !contact.active);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{contact.name}</h1>
            {!contact.active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {labelFor(CONTACT_TYPES, contact.contact_type)}
            {contact.organization ? ` · ${contact.organization}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
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
          <InfoRow label="Phone" value={contact.phone} />
          <InfoRow label="Email" value={contact.email} />
          <InfoRow
            label="Address"
            value={
              [contact.address, [contact.city, contact.state, contact.zip].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ") || undefined
            }
          />
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

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
