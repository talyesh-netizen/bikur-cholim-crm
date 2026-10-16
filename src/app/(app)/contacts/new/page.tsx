import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createContact } from "@/lib/actions/contacts";
import { safeReturnTo } from "@/lib/return-to";
import { ContactForm } from "../contact-form";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  // Started from a "Link a contact" page: saving goes back there with
  // the new person already chosen.
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const action = createContact.bind(null, returnTo);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Add a contact</h1>
        <p className="text-sm text-muted-foreground">
          {returnTo
            ? "After saving, you'll go straight back to finish linking them."
            : "Family members, rabbis, facility staff, volunteers, and other partners."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact details</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm action={action} />
        </CardContent>
      </Card>
    </div>
  );
}
