import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createContact } from "@/lib/actions/contacts";
import { ContactForm } from "../contact-form";

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a contact</h1>
        <p className="text-sm text-muted-foreground">
          Family members, rabbis, facility staff, volunteers, and other partners.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm action={createContact} />
        </CardContent>
      </Card>
    </div>
  );
}
