"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
  KOSHER_FOOD_OPTIONS,
} from "@/lib/domain/facility";
import type { Facility, GeographicCluster } from "@/lib/domain/facility";
import type { FacilityFormState } from "@/lib/actions/facilities";

type Action = (state: FacilityFormState, formData: FormData) => Promise<FacilityFormState>;

/** Converts an existing facility record into the same string-keyed shape
 * a submitted <form>'s values take, so both "editing an existing
 * facility" and "re-showing what was just typed after a failed save"
 * can feed the same fields the same way. */
function facilityToFormValues(facility?: Facility): Record<string, string> {
  if (!facility) {
    return { engagement_status: "not_contacted", visit_priority: "medium" };
  }
  return {
    name: facility.name,
    facility_type: facility.facility_type,
    address: facility.address ?? "",
    city: facility.city ?? "",
    zip: facility.zip ?? "",
    main_phone: facility.main_phone ?? "",
    website: facility.website ?? "",
    parent_healthcare_group: facility.parent_healthcare_group ?? "",
    geographic_cluster_id: facility.geographic_cluster_id ?? "",
    approx_jewish_resident_count: facility.approx_jewish_resident_count?.toString() ?? "",
    jewish_residents_currently_known: facility.jewish_residents_currently_known ? "true" : "false",
    engagement_status: facility.engagement_status,
    visit_priority: facility.visit_priority,
    recommended_visit_frequency: facility.recommended_visit_frequency ?? "",
    kosher_food_availability: facility.kosher_food_availability ?? "",
    notes: facility.notes ?? "",
  };
}

export function FacilityForm({
  action,
  clusters,
  facility,
}: {
  action: Action;
  clusters: GeographicCluster[];
  facility?: Facility;
}) {
  const [state, formAction, isPending] = useActionState<FacilityFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  // Whatever was just submitted (if the save failed) takes priority over
  // the original record, so a validation or network error never wipes
  // out what someone typed. The key forces the uncontrolled fields below
  // to pick up fresh defaultValues whenever this changes — see
  // facilityToFormValues' doc comment.
  const values = state.values ?? facilityToFormValues(facility);
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

        <Field label="Facility name" htmlFor="name" error={fieldErrors.name} required>
          <Input id="name" name="name" defaultValue={values.name} required />
        </Field>

        <Field label="Facility type" htmlFor="facility_type" error={fieldErrors.facility_type} required>
          <SelectField name="facility_type" defaultValue={values.facility_type} options={FACILITY_TYPES} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" htmlFor="address">
            <Input id="address" name="address" defaultValue={values.address} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city} />
          </Field>
          <Field label="ZIP code" htmlFor="zip">
            <Input id="zip" name="zip" defaultValue={values.zip} />
          </Field>
          <Field label="Main phone number" htmlFor="main_phone">
            <Input id="main_phone" name="main_phone" defaultValue={values.main_phone} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={values.website} />
          </Field>
          <Field label="Parent healthcare group" htmlFor="parent_healthcare_group">
            <Input
              id="parent_healthcare_group"
              name="parent_healthcare_group"
              defaultValue={values.parent_healthcare_group}
            />
          </Field>
        </div>

        <Field label="Geographic cluster" htmlFor="geographic_cluster_id">
          <SelectField
            name="geographic_cluster_id"
            defaultValue={values.geographic_cluster_id}
            options={clusters.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No cluster assigned"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Jewish resident engagement</h2>

        <div className="flex items-center gap-2">
          <Checkbox
            id="jewish_residents_currently_known"
            name="jewish_residents_currently_known"
            defaultChecked={values.jewish_residents_currently_known === "true"}
          />
          <Label htmlFor="jewish_residents_currently_known" className="font-normal">
            Jewish residents are currently known to live here
          </Label>
        </div>

        <Field
          label="Approximate number of Jewish residents"
          htmlFor="approx_jewish_resident_count"
          error={fieldErrors.approx_jewish_resident_count}
        >
          <Input
            id="approx_jewish_resident_count"
            name="approx_jewish_resident_count"
            type="number"
            min={0}
            defaultValue={values.approx_jewish_resident_count}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Engagement status" htmlFor="engagement_status" required>
            <SelectField
              name="engagement_status"
              defaultValue={values.engagement_status}
              options={ENGAGEMENT_STATUSES}
            />
          </Field>
          <Field label="Visit priority" htmlFor="visit_priority" required>
            <SelectField
              name="visit_priority"
              defaultValue={values.visit_priority}
              options={VISIT_PRIORITIES}
            />
          </Field>
          <Field label="Recommended visit frequency" htmlFor="recommended_visit_frequency">
            <Input
              id="recommended_visit_frequency"
              name="recommended_visit_frequency"
              placeholder="e.g., Weekly, Monthly"
              defaultValue={values.recommended_visit_frequency}
            />
          </Field>
          <Field label="Kosher food availability" htmlFor="kosher_food_availability">
            <SelectField
              name="kosher_food_availability"
              defaultValue={values.kosher_food_availability}
              options={KOSHER_FOOD_OPTIONS}
              placeholder="Unknown"
            />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Notes</h2>
        <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
      </section>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : facility ? "Save changes" : "Add facility"}
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
      {/* A plain hidden input mirrors the Radix Select's value so this
          field posts normally with the rest of the <form>, since Radix's
          Select doesn't render a native <select> element itself. */}
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
