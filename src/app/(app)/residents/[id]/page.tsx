import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getResident, getResidentFacilityHistory } from "@/lib/queries/residents";
import { listInteractionsForResident } from "@/lib/queries/interactions";
import { listResidentContacts } from "@/lib/queries/contacts";
import { removeResidentContact, setPrimaryResidentContact } from "@/lib/actions/resident-contacts";
import { labelFor, RESIDENT_STATUSES } from "@/lib/domain/resident";
import { labelFor as labelForContact, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import { formatDateOnly, formatDateTime } from "@/lib/format-date";
import { InteractionList } from "@/app/(app)/interactions/interaction-list";
import { Pencil, ArrowRightLeft, Building2, Plus, X, Star } from "lucide-react";

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [resident, history, interactions, familyContacts] = await Promise.all([
    getResident(id),
    getResidentFacilityHistory(id),
    listInteractionsForResident(id),
    listResidentContacts(id),
  ]);

  if (!resident) notFound();

  const displayName = resident.preferred_name
    ? `${resident.preferred_name} ${resident.last_name}`
    : `${resident.first_name} ${resident.last_name}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Building2 className="size-3.5" />
            {resident.current_facility_name}
            {resident.room_number ? ` · Room ${resident.room_number}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/interactions/new?resident=${resident.id}`}>
              <Plus className="size-4" />
              Log an interaction
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/residents/${resident.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/residents/${resident.id}/transfer`}>
              <ArrowRightLeft className="size-4" />
              Move to another facility
            </Link>
          </Button>
        </div>
      </div>

      <Badge className="w-fit">{labelFor(RESIDENT_STATUSES, resident.status)}</Badge>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact &amp; visitation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Phone number" value={resident.phone_number} />
            <InfoRow label="Preferred visit frequency" value={resident.preferred_visit_frequency} />
            <InfoRow label="Visitation needs" value={resident.visitation_needs} />
            <InfoRow label="Last visit" value={formatDateTime(resident.last_visit_at)} />
            <InfoRow label="Next follow-up" value={formatDateOnly(resident.next_follow_up_date)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jewish background &amp; needs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <InfoRow label="Rabbi / synagogue" value={resident.rabbi_synagogue_connection} />
            <InfoRow label="Interests / background" value={resident.jewish_interests_background} />
            <InfoRow label="Kosher food needs" value={resident.kosher_food_needs} />
            <InfoRow label="Holiday support needs" value={resident.holiday_support_needs} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No facility history recorded.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">{entry.facility_name}</p>
                    {entry.reason ? (
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    ) : null}
                  </div>
                  <p className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateOnly(entry.start_date)} –{" "}
                    {entry.end_date ? formatDateOnly(entry.end_date) : "present"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Family contacts</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/residents/${resident.id}/contacts/new`}>
              <Plus className="size-4" />
              Add family contact
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {familyContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No family contacts on file yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {familyContacts.map((rc) => {
                const removeContact = removeResidentContact.bind(null, resident.id, rc.id);
                const makePrimary = setPrimaryResidentContact.bind(null, resident.id, rc.id);
                return (
                  <li key={rc.id} className="flex items-start justify-between gap-4 text-sm">
                    <div>
                      <Link href={`/contacts/${rc.contact.id}`} className="font-medium hover:underline">
                        {rc.contact.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {rc.relationship_to_resident === "other" && rc.relationship_other_description
                          ? rc.relationship_other_description
                          : labelForContact(RESIDENT_CONTACT_RELATIONSHIPS, rc.relationship_to_resident)}
                        {rc.contact.phone ? ` · ${rc.contact.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {rc.is_primary_contact ? (
                        <Badge>Primary</Badge>
                      ) : (
                        <form action={makePrimary}>
                          <Button size="sm" variant="ghost" type="submit" title="Make primary contact">
                            <Star className="size-4" />
                          </Button>
                        </form>
                      )}
                      <form action={removeContact}>
                        <Button size="sm" variant="ghost" type="submit" title="Remove">
                          <X className="size-4" />
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent interactions</CardTitle>
        </CardHeader>
        <CardContent>
          <InteractionList interactions={interactions} variant="resident" />
        </CardContent>
      </Card>

      {resident.private_internal_notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Private internal notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {resident.private_internal_notes}
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
