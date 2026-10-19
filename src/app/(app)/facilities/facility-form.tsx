"use client";

import { offeredOptions } from "@/lib/domain/offered";
import { OFFERED_FACILITY_TYPES, OFFERED_ENGAGEMENT_STATUSES } from "@/lib/domain/facility";
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
} from "@/lib/domain/facility";
import type { Facility, GeographicCluster } from "@/lib/domain/facility";
import type { FacilityFormState } from "@/lib/actions/facilities";
import { capitalizeAsYouType } from "@/lib/format-text";
import { SearchPicker } from "@/components/search-picker";
import { Network } from "lucide-react";

type Action = (state: FacilityFormState, formData: FormData) => Promise<FacilityFormState>;

/** Converts an existing facility record into the same string-keyed shape
 * a submitted <form>'s values take, so both "editing an existing
 * facility" and "re-showing what was just typed after a failed save"
 * can feed the same fields the same way. */
function facilityToFormValues(facility?: Facility, alsoOffers: string[] = []): Record<string, string> {
  if (!facility) {
    return { engagement_status: "not_contacted", visit_priority: "medium" };
  }
  return {
    name: facility.name,
    facility_type: facility.facility_type,
    also_offers: alsoOffers.join(","),
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
  healthcareGroups,
  facility,
  alsoOffers,
}: {
  action: Action;
  /** Editing: the other kinds of care it offers, as saved. */
  alsoOffers?: string[];
  clusters: GeographicCluster[];
  /** Healthcare group names, A to Z, to choose from. */
  healthcareGroups: string[];
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
  const values = state.values ?? facilityToFormValues(facility, alsoOffers);
  const [mainType, setMainType] = useState(values.facility_type ?? "");
  const [also, setAlso] = useState<string[]>(() => (values.also_offers ? values.also_offers.split(",") : []));
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
          <Input id="name" name="name" defaultValue={values.name} autoCapitalize="words" onChange={capitalizeAsYouType} required />
        </Field>

        <Field label="Facility type" htmlFor="facility_type" error={fieldErrors.facility_type} required>
          <SelectField
            name="facility_type"
            value={mainType}
            onValueChange={setMainType}
            options={offeredOptions(FACILITY_TYPES, OFFERED_FACILITY_TYPES, values.facility_type)}
          />
        </Field>

        {/* A second (or third) kind of care, e.g. assisted living that
            also has memory care. Lists and reports use the main type. */}
        <div className="flex flex-col gap-1.5">
          <Label>Also offers (optional)</Label>
          <input type="hidden" name="also_offers_shown" value="1" />
          <div className="flex flex-wrap gap-2">
            {FACILITY_TYPES.filter(
              (t) => t.value !== mainType && t.value !== "other" && ((OFFERED_FACILITY_TYPES as readonly string[]).includes(t.value) || also.includes(t.value))
            ).map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10"
              >
                <input
                  type="checkbox"
                  name="also_offers"
                  value={t.value}
                  checked={also.includes(t.value)}
                  onChange={(e) => setAlso(e.target.checked ? [...also, t.value] : also.filter((v) => v !== t.value))}
                  className="size-4 accent-[var(--primary)]"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" htmlFor="address">
            <Input id="address" name="address" defaultValue={values.address} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={values.city} autoCapitalize="words" onChange={capitalizeAsYouType} />
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
          <Field label="Healthcare group (owner)" htmlFor="parent_healthcare_group">
            {/* Chosen from the groups list, so the name always matches the
                group's page. A name typed before this list existed is kept. */}
            <SearchPicker
              id="parent_healthcare_group"
              name="parent_healthcare_group"
              icon={Network}
              defaultValue={values.parent_healthcare_group}
              options={[
                ...healthcareGroups,
                ...(values.parent_healthcare_group &&
                !healthcareGroups.some((g) => g.toLowerCase() === values.parent_healthcare_group.trim().toLowerCase())
                  ? [values.parent_healthcare_group]
                  : []),
              ].map((g) => ({ id: g, label: g }))}
              emptyLabel="No healthcare group"
              placeholder="Type the group's name…"
            />
          </Field>
        </div>

        <Field label="Geographic cluster" htmlFor="geographic_cluster_id">
          <SelectField
            name="geographic_cluster_id"
            defaultValue={values.geographic_cluster_id}
            options={clusters.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} (retired)` }))}
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
              options={offeredOptions(ENGAGEMENT_STATUSES, OFFERED_ENGAGEMENT_STATUSES, values.engagement_status)}
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
          {/* Not asked any more (rarely known); a saved value is kept. */}
          <input type="hidden" name="kosher_food_availability" value={values.kosher_food_availability ?? ""} readOnly />
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
  value: controlledValue,
  onValueChange,
  options,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  /** Pass both to follow the choice from outside (e.g. Facility type). */
  value?: string;
  onValueChange?: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

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
