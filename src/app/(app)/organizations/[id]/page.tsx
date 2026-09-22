import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrganization, listOrganizationContacts } from "@/lib/queries/organizations";
import { setOrganizationActive, setOrganizationContactActive, setPrimaryOrganizationContact } from "@/lib/actions/organizations";
import { labelFor, ORGANIZATION_TYPES } from "@/lib/domain/organization";
import { labelFor as labelForContact, CONTACT_TYPES } from "@/lib/domain/contact";
import { InfoRow } from "@/components/info-row";
import { telHref, websiteHref, mapsHref } from "@/lib/link-helpers";
import { Pencil, Plus, UserX, Undo2, Star } from "lucide-react";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [organization, contacts] = await Promise.all([
    getOrganization(id),
    listOrganizationContacts(id),
  ]);

  if (!organization) notFound();

  const toggleActive = setOrganizationActive.bind(null, organization.id, !organization.active);
  const mainContact = contacts.find((c) => c.is_primary_contact) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{organization.name}</h1>
            {!organization.active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {labelFor(ORGANIZATION_TYPES, organization.organization_type)}
            {organization.city ? ` · ${organization.city}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/organizations/${organization.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <form action={toggleActive}>
            <Button variant="outline" type="submit">
              {organization.active ? "Mark inactive" : "Mark active"}
            </Button>
          </form>
        </div>
      </div>

      {mainContact ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          <span className="font-medium">
            <Link href={`/contacts/${mainContact.contact.id}`} className="hover:underline">
              {mainContact.contact.name}
            </Link>
          </span>
          <span className="text-muted-foreground">
            {mainContact.role_at_organization || labelForContact(CONTACT_TYPES, mainContact.contact.contact_type)}
          </span>
          {mainContact.contact.phone ? (
            <a href={telHref(mainContact.contact.phone)} className="text-muted-foreground hover:text-foreground hover:underline">
              {mainContact.contact.phone}
            </a>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <InfoRow label="Address" value={formatAddress(organization)} href={mapsHref(formatAddress(organization))} />
          <InfoRow label="Main phone" value={organization.main_phone} href={telHref(organization.main_phone)} />
          <InfoRow label="Website" value={organization.website} href={websiteHref(organization.website)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Contacts ({contacts.length})</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/organizations/${organization.id}/contacts/new`}>
              <Plus className="size-4" />
              Link a contact
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {contacts.map((oc) => {
                const deactivate = setOrganizationContactActive.bind(null, organization.id, oc.id, false);
                const reactivate = setOrganizationContactActive.bind(null, organization.id, oc.id, true);
                const makePrimary = setPrimaryOrganizationContact.bind(null, organization.id, oc.id);
                return (
                  <li
                    key={oc.id}
                    className={`relative -mx-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 flex items-start justify-between gap-4 text-sm ${oc.active ? "" : "opacity-60"}`}
                  >
                    <div>
                      <Link href={`/contacts/${oc.contact.id}`} className="stretched-link font-medium hover:underline">
                        {oc.contact.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {oc.role_at_organization || labelForContact(CONTACT_TYPES, oc.contact.contact_type)}
                        {oc.contact.phone ? (
                          <>
                            {" · "}
                            <a href={telHref(oc.contact.phone)} className="relative z-10 hover:underline">
                              {oc.contact.phone}
                            </a>
                          </>
                        ) : (
                          ""
                        )}
                      </p>
                    </div>
                    <div className="relative z-10 flex items-center gap-1">
                      {!oc.active ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : oc.is_primary_contact ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <form action={makePrimary}>
                          <Button size="sm" variant="ghost" type="submit" title="Make primary contact">
                            <Star className="size-4" />
                          </Button>
                        </form>
                      )}
                      {oc.active ? (
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

      {organization.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {organization.notes}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function formatAddress(organization: {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}) {
  const parts = [
    organization.address,
    [organization.city, organization.state, organization.zip].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}
