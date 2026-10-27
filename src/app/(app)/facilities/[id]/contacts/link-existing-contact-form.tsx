"use client";

import { StaffRoleField } from "@/components/staff-role-field";
import { FormActions, FormError } from "@/components/form-actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchPicker } from "@/components/search-picker";
import type { FacilityContactFormState } from "@/lib/actions/facility-contacts";

type Action = (
  state: FacilityContactFormState,
  formData: FormData
) => Promise<FacilityContactFormState>;

export function LinkExistingContactForm({
  action,
  contacts,
  defaultContactId,
  addNewHref,
}: {
  action: Action;
  contacts: { id: string; name: string; detail?: string | null }[];
  /** Chosen on arrival (e.g. just added on the "new contact" page). */
  defaultContactId?: string;
  /** "Add a new contact" -- comes back here with them chosen. */
  addNewHref: string;
}) {
  const [state, formAction, isPending] = useActionState<FacilityContactFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const [contactId, setContactId] = useState(state.values?.contact_id ?? defaultContactId ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact_id">
          Contact <span className="text-destructive">*</span>
        </Label>
        <SearchPicker
          id="contact_id"
          name="contact_id"
          options={contacts.map((c) => ({ id: c.id, label: c.name, detail: c.detail }))}
          value={contactId}
          onChange={setContactId}
          placeholder="Type a name…"
        />
        {fieldErrors.contact_id ? <p className="text-xs text-destructive">{fieldErrors.contact_id}</p> : null}
        <p className="text-xs text-muted-foreground">
          Not in the CRM yet?{" "}
          <Link href={addNewHref} className="font-medium underline">
            Add a new contact
          </Link>{" "}
          and you&apos;ll come right back here.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role_at_facility">Role at this facility</Label>
        <StaffRoleField id="role_at_facility" name="role_at_facility" defaultValue={state.values?.role_at_facility} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="is_primary_contact" name="is_primary_contact" />
        <Label htmlFor="is_primary_contact" className="text-sm font-normal">
          Make this the facility&apos;s Primary Contact
        </Label>
      </div>

      <FormActions
        isPending={isPending} disabled={!contactId}
        submitLabel={"Link contact"}
        savingLabel={"Linking…"}
        hasUnsavedError={!!state.error}
      />
    </form>
  );
}
