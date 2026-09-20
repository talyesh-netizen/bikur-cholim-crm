import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listContacts } from "@/lib/queries/contacts";
import { CONTACT_QUICK_FILTERS } from "@/lib/domain/contact";
import { contactTypeColor } from "@/lib/domain/contact-colors";
import { ContactFilters } from "./contact-filters";
import { ContactCard } from "./contact-card";
import { cn } from "@/lib/utils";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const contacts = await listContacts({
    search: params.search,
    contactType: params.type,
    showInactive: params.all === "1",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus className="size-4" />
            Add contact
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
        <Link
          href="/contacts"
          className={cn(
            "rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
            !params.type ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </Link>
        {CONTACT_QUICK_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/contacts?type=${f.key}`}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors",
              params.type === f.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: contactTypeColor(f.types[0]) }}
            />
            {f.label}
          </Link>
        ))}
      </div>

      <ContactFilters />

      {contacts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No contacts match your search. Try adjusting the filters above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  );
}
