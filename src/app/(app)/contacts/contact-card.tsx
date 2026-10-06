import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorBadge } from "@/components/color-badge";
import { primaryProfileColor, primaryProfileLabel } from "@/lib/domain/primary-profile";
import { inactiveContactLabel } from "@/lib/domain/contact";
import type { ContactListItem } from "@/lib/queries/contacts";
import { formatDateTime } from "@/lib/format-date";
import { labelFor, INTERACTION_TYPES } from "@/lib/domain/interaction";

export function ContactCard({ contact }: { contact: ContactListItem }) {
  const roleLine = contact.role_at_facility
    ? `${contact.role_at_facility}${contact.facility_name ? ` at ${contact.facility_name}` : ""}`
    : null;
  const facility = contact.facility_name ? { name: contact.facility_name, clusterId: contact.facility_cluster_id } : null;
  const organization = contact.organization_name
    ? { name: contact.organization_name, organizationType: contact.organization_type }
    : null;
  const color = primaryProfileColor(contact, facility, organization);
  const label = primaryProfileLabel(contact, facility, organization);

  return (
    <Link href={`/contacts/${contact.id}`}>
      <Card
        className={
          contact.active
            ? "border-l-4 transition-colors hover:border-primary/50"
            : "border-l-4 opacity-70 transition-colors hover:border-primary/50"
        }
        style={{ borderLeftColor: color }}
      >
        <CardContent className="flex flex-col gap-2 p-4 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{contact.name}</p>
              {contact.organization ? (
                <span className="text-sm text-muted-foreground">{contact.organization}</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <ColorBadge color={color} label={label} />
              {!contact.active ? (
                <Badge variant="destructive">{inactiveContactLabel(contact.contact_type)}</Badge>
              ) : null}
            </div>
          </div>

          {roleLine ? <p className="text-sm text-muted-foreground">{roleLine}</p> : null}

          <p className="text-xs text-muted-foreground">
            {contact.last_contact_at
              ? `Last contact: ${formatDateTime(contact.last_contact_at)}${
                  contact.last_contact_type
                    ? ` · ${labelFor(INTERACTION_TYPES, contact.last_contact_type).replace(/\s*\(.*\)$/, "")}`
                    : ""
                }`
              : "No contact logged yet"}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {contact.phone ? <span>{contact.phone}</span> : null}
            {contact.email ? <span>{contact.email}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
