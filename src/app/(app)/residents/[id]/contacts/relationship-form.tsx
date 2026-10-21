"use client";

import { offeredOptions } from "@/lib/domain/offered";
import { OFFERED_RELATIONSHIPS } from "@/lib/domain/contact";
import { FormActions, FormError } from "@/components/form-actions";
import { useActionState, useState } from "react";
import Link from "next/link";
import { SearchPicker } from "@/components/search-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";
import type { RelationshipFormState } from "@/lib/actions/resident-contacts";
import type { ResidentContact } from "@/lib/domain/contact";

type Action = (state: RelationshipFormState, formData: FormData) => Promise<RelationshipFormState>;

function toFormValues(residentContact?: ResidentContact): Record<string, string> {
  if (!residentContact) return { relationship_to_resident: "", relationship_other_description: "", relationship_notes: "" };
  return {
    relationship_to_resident: residentContact.relationship_to_resident,
    relationship_other_description: residentContact.relationship_other_description ?? "",
    relationship_notes: residentContact.relationship_notes ?? "",
  };
}

export function RelationshipForm({
  action,
  residentContact,
  link,
}: {
  action: Action;
  /** The family link being edited. */
  residentContact?: ResidentContact;
  /** Instead: linking someone already in the CRM as family -- they're
   * picked here. */
  link?: {
    contacts: { id: string; name: string; detail?: string | null }[];
    defaultContactId?: string;
    /** "Add a new person" instead. */
    addNewHref: string;
  };
}) {
  const [state, formAction, isPending] = useActionState<RelationshipFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? toFormValues(residentContact);
  const formKey = JSON.stringify(values);
  const [relationship, setRelationship] = useState(values.relationship_to_resident);
  const [contactId, setContactId] = useState(values.contact_id ?? link?.defaultContactId ?? "");

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      <FormError message={state.error} />

      {link ? (
        <Field label="Who" htmlFor="contact_id" error={fieldErrors.contact_id} required>
          <SearchPicker
            id="contact_id"
            name="contact_id"
            options={link.contacts.map((c) => ({ id: c.id, label: c.name, detail: c.detail }))}
            value={contactId}
            onChange={setContactId}
            placeholder="Type their name…"
          />
          <p className="text-xs text-muted-foreground">
            Not in the CRM yet?{" "}
            <Link href={link.addNewHref} className="font-medium underline">
              Add them as a new family contact
            </Link>{" "}
            instead.
          </p>
        </Field>
      ) : null}

      <Field
        label="Relationship to resident"
        htmlFor="relationship_to_resident"
        error={fieldErrors.relationship_to_resident}
        required
      >
        <SelectField
          name="relationship_to_resident"
          value={relationship}
          onValueChange={setRelationship}
          options={offeredOptions(RESIDENT_CONTACT_RELATIONSHIPS, OFFERED_RELATIONSHIPS, values.relationship_to_resident)}
          placeholder="Choose a relationship…"
        />
      </Field>

      {relationship === "other" ? (
        <Field
          label="Describe the relationship"
          htmlFor="relationship_other_description"
          error={fieldErrors.relationship_other_description}
          required
        >
          <Input
            id="relationship_other_description"
            name="relationship_other_description"
            defaultValue={values.relationship_other_description}
          />
        </Field>
      ) : (
        <input
          type="hidden"
          name="relationship_other_description"
          value={values.relationship_other_description ?? ""}
          readOnly
        />
      )}

      <Field label="Notes about this relationship" htmlFor="relationship_notes">
        <Textarea
          id="relationship_notes"
          name="relationship_notes"
          rows={3}
          defaultValue={values.relationship_notes}
        />
      </Field>

      {link ? (
        <div className="flex items-center gap-2">
          <Checkbox id="is_primary_contact" name="is_primary_contact" />
          <Label htmlFor="is_primary_contact" className="text-sm font-normal">
            Make them the resident&apos;s Primary Contact
          </Label>
        </div>
      ) : null}

      <FormActions
        isPending={isPending}
        disabled={link ? !contactId || !relationship : undefined}
        submitLabel={link ? "Link as family" : "Save changes"}
        savingLabel={link ? "Linking…" : "Saving…"}
        hasUnsavedError={!!state.error}
      />
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  name,
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  options,
  placeholder,
}: {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue ?? internalValue;
  const setValue = controlledOnValueChange ?? setInternalValue;

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
