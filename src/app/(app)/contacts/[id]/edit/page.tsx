import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContact } from "@/lib/queries/contacts";
import { updateContact } from "@/lib/actions/contacts";
import { ContactForm } from "../../contact-form";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();

  const action = updateContact.bind(null, contact.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Edit {contact.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm action={action} contact={contact} />
        </CardContent>
      </Card>
    </div>
  );
}
