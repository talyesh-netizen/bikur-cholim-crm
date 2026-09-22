"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FacilityContactFormState } from "@/lib/actions/facility-contacts";

type Action = (
  state: FacilityContactFormState,
  formData: FormData
) => Promise<FacilityContactFormState>;

export function LinkExistingContactForm({
  action,
  contacts,
}: {
  action: Action;
  contacts: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState<FacilityContactFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const [contactId, setContactId] = useState(state.values?.contact_id ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact_id">
          Contact <span className="text-destructive">*</span>
        </Label>
        <input type="hidden" name="contact_id" value={contactId} readOnly />
        <Select value={contactId} onValueChange={setContactId}>
          <SelectTrigger id="contact_id">
            <SelectValue placeholder="Choose an existing contact…" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.contact_id ? <p className="text-xs text-destructive">{fieldErrors.contact_id}</p> : null}
        <p className="text-xs text-muted-foreground">
          Don&apos;t see who you&apos;re looking for?{" "}
          <Link href="/contacts/new" className="underline">
            Add them as a contact first
          </Link>
          , then come back here to link them.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role_at_facility">Role at this facility</Label>
        <Input
          id="role_at_facility"
          name="role_at_facility"
          placeholder="e.g., Activities Director, Social Worker, Administrator"
          defaultValue={state.values?.role_at_facility}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="is_primary_contact" name="is_primary_contact" />
        <Label htmlFor="is_primary_contact" className="text-sm font-normal">
          Make this the facility&apos;s Primary Contact
        </Label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !contactId}>
          {isPending ? "Linking…" : "Link contact"}
        </Button>
      </div>
    </form>
  );
}
