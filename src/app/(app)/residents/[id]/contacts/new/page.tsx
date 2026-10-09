import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResident } from "@/lib/queries/residents";
import { addFamilyContact } from "@/lib/actions/resident-contacts";
import { FamilyContactForm } from "../family-contact-form";
import { residentName } from "@/lib/domain/resident-name";
import { onsiteHref } from "@/lib/onsite-links";

export default async function NewFamilyContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const resident = await getResident(id);
  if (!resident) notFound();

  const displayName = residentName(resident);
  // Added on site: back there, with this resident still open.
  const action = addFamilyContact.bind(
    null,
    resident.id,
    from === "onsite" ? onsiteHref(resident.current_facility_id, "residents", resident.id) : undefined
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a family contact</h1>
        <p className="text-sm text-muted-foreground">For {displayName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyContactForm action={action} />
        </CardContent>
      </Card>
    </div>
  );
}
