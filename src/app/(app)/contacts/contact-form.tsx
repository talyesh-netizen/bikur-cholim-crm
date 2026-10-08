"use client";

import { offeredOptions } from "@/lib/domain/offered";
import { OFFERED_CONTACT_TYPES } from "@/lib/domain/contact";
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
import {
  CONTACT_TYPES,
  BACKGROUND_CHECK_STATUSES,
} from "@/lib/domain/contact";
import type { Contact } from "@/lib/domain/contact";
import type { ContactFormState } from "@/lib/actions/contacts";
import { capitalizeAsYouType } from "@/lib/format-text";

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
    primary_profile_kind: contact.primary_profile_kind,
    background_check_status: contact.background_check_status,
    background_check_date: contact.background_check_date ?? "",
    availability_notes: contact.availability_notes ?? "",
  };
}

export function ContactForm({
  action,
  contact,
  primaryFacilityName,
  primaryOrganizationName,
}: {
  action: Action;
  contact?: Contact;
  /** Only known once the contact exists and has an active primary
   * facility/organization link -- shown as extra context in the
   * "Primary profile" picker below, and used to hide options that
   * wouldn't have anything to follow. */
  primaryFacilityName?: string | null;
  primaryOrganizationName?: string | null;
}) {
  const [state, formAction, isPending] = useActionState<ContactFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? contactToFormValues(contact);
  const formKey = JSON.stringify(values);
  const [contactType, setContactType] = useState(values.contact_type);
  const isVolunteer = contactType === "volunteer";

  // Lifted out of the volunteer-info fields below (rather than left as
  // defaultValue on uncontrolled inputs) so an edit survives toggling
  // "Contact type" away from Volunteer and back before saving -- those
  // fields unmount/remount with the toggle, which would otherwise reset
  // them to their original saved value and silently drop the edit.
  const [backgroundCheckStatus, setBackgroundCheckStatus] = useState(
    values.background_check_status || "not_started"
  );
  const [backgroundCheckDate, setBackgroundCheckDate] = useState(values.background_check_date ?? "");
  const [availabilityNotes, setAvailabilityNotes] = useState(values.availability_notes ?? "");

  // A saved "facility"/"organization" kind whose link has since been
  // deactivated has nothing to show here (it's filtered out above) --
  // without this, the picker would render blank instead of showing what
  // read-only views already fall back to displaying.
  const primaryProfileValue =
    (values.primary_profile_kind === "facility" && !primaryFacilityName) ||
    (values.primary_profile_kind === "organization" && !primaryOrganizationName)
      ? "contact_type"
      : values.primary_profile_kind;

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={fieldErrors.name} required>
          <Input id="name" name="name" defaultValue={values.name} autoCapitalize="words" onChange={capitalizeAsYouType} required />
        </Field>
        <Field label="Contact type" htmlFor="contact_type" error={fieldErrors.contact_type} required>
          <SelectField
            name="contact_type"
            value={contactType}
            onValueChange={setContactType}
            options={offeredOptions(CONTACT_TYPES, OFFERED_CONTACT_TYPES, values.contact_type)}
            placeholder="Choose a type…"
          />
        </Field>
      </div>

      {/* Not asked any more; whatever was saved is kept. */}
      {contact ? <input type="hidden" name="primary_profile_kind" value={primaryProfileValue} readOnly /> : null}

      {isVolunteer ? (
        <div className="flex flex-col gap-4 rounded-md border border-border p-3">
          <p className="text-sm font-medium">Volunteer info</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Background check" htmlFor="background_check_status">
              <SelectField
                name="background_check_status"
                value={backgroundCheckStatus}
                onValueChange={setBackgroundCheckStatus}
                options={BACKGROUND_CHECK_STATUSES}
              />
            </Field>
            <Field label="Background check date" htmlFor="background_check_date">
              <Input
                id="background_check_date"
                name="background_check_date"
                type="date"
                value={backgroundCheckDate}
                onChange={(e) => setBackgroundCheckDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Availability" htmlFor="availability_notes">
            <Input
              id="availability_notes"
              name="availability_notes"
              placeholder="e.g., Tuesdays and Thursdays, mornings"
              value={availabilityNotes}
              onChange={(e) => setAvailabilityNotes(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        // Not shown for this type right now, but if this contact already
        // has volunteer info saved, carry it through unchanged instead of
        // wiping it out just because the type field was touched.
        <>
          <input type="hidden" name="background_check_status" value={backgroundCheckStatus} readOnly />
          <input type="hidden" name="background_check_date" value={backgroundCheckDate} readOnly />
          <input type="hidden" name="availability_notes" value={availabilityNotes} readOnly />
        </>
      )}

      <Field label="Organization (free text)" htmlFor="organization">
        <Input id="organization" name="organization" defaultValue={values.organization} autoCapitalize="words" onChange={capitalizeAsYouType} />
        <p className="text-xs text-muted-foreground">
          A note about where they work/belong — separate from linking this contact to an actual
          Organization record, which is done from that organization&apos;s own page.
        </p>
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
          <Input id="city" name="city" defaultValue={values.city} autoCapitalize="words" onChange={capitalizeAsYouType} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={values.state} />
        </Field>
        <Field label="ZIP" htmlFor="zip">
          <Input id="zip" name="zip" defaultValue={values.zip} />
        </Field>
      </div>

      {/* Not asked any more (kept simple); a saved value is kept. */}
      <input type="hidden" name="preferred_communication_method" value={values.preferred_communication_method ?? ""} readOnly />

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
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  options,
  placeholder,
  allowEmpty,
}: {
  name: string;
  defaultValue?: string;
  /** Pass value + onValueChange together to let a parent react to this
   * field's selection instead of managing it internally. */
  value?: string;
  onValueChange?: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const setValue = controlledOnValueChange ?? setInternalValue;

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
