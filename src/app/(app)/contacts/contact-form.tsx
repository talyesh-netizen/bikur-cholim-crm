"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { CONTACT_TYPES, PREFERRED_COMMUNICATION_METHODS } from "@/lib/domain/contact";
import type { Contact } from "@/lib/domain/contact";
import type { ContactFormState } from "@/lib/actions/contacts";

type Action = (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;

function contactToFormValues(contact?: Contact): Record<string, string> {
  if (!contact) return {};
  return {
    name: contact.name,
    organization: contact.organization ?? "",
    contact_type: contact.contact_type,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    city: contact.city ?? "",
    state: contact.state ?? "",
    zip: contact.zip ?? "",
    preferred_communication_method: contact.preferred_communication_method ?? "",
    notes: contact.notes ?? "",
  };
}

export function ContactForm({ action, contact }: { action: Action; contact?: Contact }) {
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? contactToFormValues(contact);
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

      <Field label="Organization" htmlFor="organization">
        <Input id="organization" name="organization" defaultValue={values.organization} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={values.email} />
        </Field>
      </div>

      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" defaultValue={values.address} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={values.city} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={values.state} />
        </Field>
        <Field label="ZIP" htmlFor="zip">
          <Input id="zip" name="zip" defaultValue={values.zip} />
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

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={values.notes} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : contact ? "Save changes" : "Add contact"}
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
