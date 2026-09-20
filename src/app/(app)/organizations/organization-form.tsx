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
import { ORGANIZATION_TYPES } from "@/lib/domain/organization";
import type { Organization } from "@/lib/domain/organization";
import type { OrganizationFormState } from "@/lib/actions/organizations";
import { capitalizeOnBlur } from "@/lib/format-text";

type Action = (state: OrganizationFormState, formData: FormData) => Promise<OrganizationFormState>;

function organizationToFormValues(organization?: Organization): Record<string, string> {
  if (!organization) return { organization_type: "synagogue" };
  return {
    name: organization.name,
    organization_type: organization.organization_type,
    address: organization.address ?? "",
    city: organization.city ?? "",
    state: organization.state ?? "",
    zip: organization.zip ?? "",
    main_phone: organization.main_phone ?? "",
    website: organization.website ?? "",
    notes: organization.notes ?? "",
  };
}

export function OrganizationForm({
  action,
  organization,
}: {
  action: Action;
  organization?: Organization;
}) {
  const [state, formAction, isPending] = useActionState<OrganizationFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? organizationToFormValues(organization);
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Field label="Name" htmlFor="name" error={fieldErrors.name} required>
        <Input id="name" name="name" defaultValue={values.name} onBlur={capitalizeOnBlur} required />
      </Field>

      <Field label="Type" htmlFor="organization_type" error={fieldErrors.organization_type} required>
        <SelectField name="organization_type" defaultValue={values.organization_type} options={ORGANIZATION_TYPES} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address" htmlFor="address">
          <Input id="address" name="address" defaultValue={values.address} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={values.city} onBlur={capitalizeOnBlur} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={values.state} />
        </Field>
        <Field label="ZIP code" htmlFor="zip">
          <Input id="zip" name="zip" defaultValue={values.zip} />
        </Field>
        <Field label="Main phone" htmlFor="main_phone">
          <Input id="main_phone" name="main_phone" defaultValue={values.main_phone} />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" name="website" defaultValue={values.website} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : organization ? "Save changes" : "Add organization"}
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
}: {
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={value} readOnly />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={name}>
          <SelectValue placeholder="Select…" />
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
