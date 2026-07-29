import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { labelFor, CONTACT_TYPES } from "@/lib/domain/contact";
import type { Contact } from "@/lib/domain/contact";

export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Link href={`/contacts/${contact.id}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{contact.name}</p>
              {contact.organization ? (
                <span className="text-sm text-muted-foreground">{contact.organization}</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="secondary">{labelFor(CONTACT_TYPES, contact.contact_type)}</Badge>
              {!contact.active ? <Badge variant="outline">Inactive</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {contact.phone ? <span>{contact.phone}</span> : null}
            {contact.email ? <span>{contact.email}</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
