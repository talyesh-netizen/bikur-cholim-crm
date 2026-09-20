import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContactTypeBadge } from "@/components/contact-type-badge";
import { labelFor, CONTACT_TYPES } from "@/lib/domain/contact";
import { contactTypeColor } from "@/lib/domain/contact-colors";
import type { ContactListItem } from "@/lib/queries/contacts";

// A contact who has left their role reads better as "Left role" than
// the generic "Inactive" — it's the far more common reason a facility
// staff or community contact gets deactivated here.
const LEFT_ROLE_TYPES = new Set(["facility_staff", "community_partner", "rabbi", "synagogue_contact"]);

export function ContactCard({ contact }: { contact: ContactListItem }) {
  const roleLine = contact.role_at_facility
    ? `${contact.role_at_facility}${contact.facility_name ? ` at ${contact.facility_name}` : ""}`
    : null;

  return (
    <Link href={`/contacts/${contact.id}`}>
      <Card
        className={
          contact.active
            ? "border-l-4 transition-colors hover:border-primary/50"
            : "border-l-4 opacity-70 transition-colors hover:border-primary/50"
        }
        style={{ borderLeftColor: contactTypeColor(contact.contact_type) }}
      >
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{contact.name}</p>
              {contact.organization ? (
                <span className="text-sm text-muted-foreground">{contact.organization}</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <ContactTypeBadge
                contactType={contact.contact_type}
                label={labelFor(CONTACT_TYPES, contact.contact_type)}
              />
              {!contact.active ? (
                <Badge variant="destructive">
                  {LEFT_ROLE_TYPES.has(contact.contact_type) ? "Left role" : "Inactive"}
                </Badge>
              ) : null}
            </div>
          </div>

          {roleLine ? <p className="text-sm text-muted-foreground">{roleLine}</p> : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {contact.phone ? <span>{contact.phone}</span> : null}
            {contact.email ? <span>{contact.email}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
