"use client";

import { useActionState, useState } from "react";
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
import { CONTACT_TYPES, PREFERRED_COMMUNICATION_METHODS } from "@/lib/domain/contact";
import type { FacilityContactFormState } from "@/lib/actions/facility-contacts";

type Action = (
  state: FacilityContactFormState,
  formData: FormData
) => Promise<FacilityContactFormState>;

export function FacilityContactForm({ action }: { action: Action }) {
  const [state, formAction, isPending] = useActionState<FacilityContactFormState, FormData>(
    action,
    { error: null }
  );
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? { contact_type: "facility_staff" };
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fieldErrors.name} required>
          <Input id="name" name="name" defaultValue={values.name} required />
        </Field>
        <Field label="Contact type" htmlFor="contact_type" error={fieldErrors.contact_type} required>
          <SelectField
            name="contact_type"
            defaultValue={values.contact_type}
            options={CONTACT_TYPES}
            placeholder="Choose a type…"
          />
        </Field>
      </div>

      <Field label="Role at this facility" htmlFor="role_at_facility">
        <Input
          id="role_at_facility"
          name="role_at_facility"
          placeholder="e.g., Activities director, Chaplain"
          defaultValue={values.role_at_facility}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={values.email} />
        </Field>
      </div>

      <Field label="Preferred communication method" htmlFor="preferred_communication_method">
        <SelectField
          name="preferred_communication_method"
          defaultValue={values.preferred_communication_method}
          options={PREFERRED_COMMUNICATION_METHODS}
          placeholder="No preference on file"
          allowEmpty
        />
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_primary_contact"
          name="is_primary_contact"
          defaultChecked={values.is_primary_contact === "on"}
        />
        <Label htmlFor="is_primary_contact" className="text-sm font-normal">
          Make this the facility&apos;s Primary Contact
        </Label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Add facility contact"}
        </Button>
      </div>
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectField({
  name,
  defaultValue,
  options,
  placeholder,
  allowEmpty,
}: {
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Select value={value} onValueChange={(v) => setValue(v === "__none__" ? "" : v)}>
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? (
            <SelectItem value="__none__">{placeholder ?? "None"}</SelectItem>
          ) : null}
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
