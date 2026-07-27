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
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import type { Resident } from "@/lib/domain/resident";
import type { ResidentFormState } from "@/lib/actions/residents";

type Action = (state: ResidentFormState, formData: FormData) => Promise<ResidentFormState>;

function residentToFormValues(resident?: Resident): Record<string, string> {
  if (!resident) return { status: "active" };
  return {
    first_name: resident.first_name,
    last_name: resident.last_name,
    preferred_name: resident.preferred_name ?? "",
    room_number: resident.room_number ?? "",
    phone_number: resident.phone_number ?? "",
    rabbi_synagogue_connection: resident.rabbi_synagogue_connection ?? "",
    jewish_interests_background: resident.jewish_interests_background ?? "",
    kosher_food_needs: resident.kosher_food_needs ?? "",
    holiday_support_needs: resident.holiday_support_needs ?? "",
    visitation_needs: resident.visitation_needs ?? "",
    preferred_visit_frequency: resident.preferred_visit_frequency ?? "",
    status: resident.status,
    private_internal_notes: resident.private_internal_notes ?? "",
  };
}

export function ResidentForm({
  action,
  resident,
  facilities,
  defaultFacilityId,
}: {
  action: Action;
  resident?: Resident;
  /** Only passed when adding a new resident — editing never shows a
   * facility picker; see the comment in lib/actions/residents.ts. */
  facilities?: { id: string; name: string }[];
  defaultFacilityId?: string;
}) {
  const [state, formAction, isPending] = useActionState<ResidentFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const values = state.values ?? residentToFormValues(resident);
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Basic information</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name" error={fieldErrors.first_name} required>
            <Input id="first_name" name="first_name" defaultValue={values.first_name} required />
          </Field>
          <Field label="Last name" htmlFor="last_name" error={fieldErrors.last_name} required>
            <Input id="last_name" name="last_name" defaultValue={values.last_name} required />
          </Field>
        </div>

        <Field label="Preferred name" htmlFor="preferred_name">
          <Input id="preferred_name" name="preferred_name" defaultValue={values.preferred_name} />
        </Field>

        {facilities ? (
          <Field
            label="Facility"
            htmlFor="current_facility_id"
            error={fieldErrors.current_facility_id}
            required
          >
            <SelectField
              name="current_facility_id"
              defaultValue={values.current_facility_id ?? defaultFacilityId}
              options={facilities.map((f) => ({ value: f.id, label: f.name }))}
              placeholder="Choose a facility…"
            />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room number" htmlFor="room_number">
            <Input id="room_number" name="room_number" defaultValue={values.room_number} />
          </Field>
          <Field label="Phone number" htmlFor="phone_number">
            <Input id="phone_number" name="phone_number" defaultValue={values.phone_number} />
          </Field>
        </div>

        <Field label="Status" htmlFor="status" required>
          <SelectField name="status" defaultValue={values.status} options={RESIDENT_STATUSES} />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Jewish background &amp; needs
        </h2>

        <Field label="Rabbi or synagogue connection" htmlFor="rabbi_synagogue_connection">
          <Input
            id="rabbi_synagogue_connection"
            name="rabbi_synagogue_connection"
            defaultValue={values.rabbi_synagogue_connection}
          />
        </Field>
        <Field label="Jewish interests or background" htmlFor="jewish_interests_background">
          <Textarea
            id="jewish_interests_background"
            name="jewish_interests_background"
            rows={2}
            defaultValue={values.jewish_interests_background}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kosher food needs" htmlFor="kosher_food_needs">
            <Input id="kosher_food_needs" name="kosher_food_needs" defaultValue={values.kosher_food_needs} />
          </Field>
          <Field label="Preferred visit frequency" htmlFor="preferred_visit_frequency">
            <Input
              id="preferred_visit_frequency"
              name="preferred_visit_frequency"
              placeholder="e.g., Weekly, Monthly"
              defaultValue={values.preferred_visit_frequency}
            />
          </Field>
        </div>
        <Field label="Holiday support needs" htmlFor="holiday_support_needs">
          <Textarea
            id="holiday_support_needs"
            name="holiday_support_needs"
            rows={2}
            defaultValue={values.holiday_support_needs}
          />
        </Field>
        <Field label="Visitation needs" htmlFor="visitation_needs">
          <Textarea
            id="visitation_needs"
            name="visitation_needs"
            rows={2}
            defaultValue={values.visitation_needs}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Private internal notes</h2>
        <p className="text-xs text-muted-foreground">
          For sensitive details you wouldn&apos;t want shared outside the
          department — never visible to facilities or family members.
        </p>
        <Textarea
          id="private_internal_notes"
          name="private_internal_notes"
          rows={4}
          defaultValue={values.private_internal_notes}
        />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : resident ? "Save changes" : "Add resident"}
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
}: {
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

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
