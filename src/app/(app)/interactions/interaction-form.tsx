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
import { INTERACTION_TYPES } from "@/lib/domain/interaction";
import type { InteractionFormState } from "@/lib/actions/interactions";

type Action = (
  state: InteractionFormState,
  formData: FormData
) => Promise<InteractionFormState>;

/** "2026-07-28T14:30", the format <input type="datetime-local"> needs —
 * built from local date/time parts (not toISOString(), which would
 * shift to UTC and show the wrong time of day). */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function InteractionForm({
  action,
  facilities,
  defaultFacilityId,
  fixedResident,
  residents,
  contacts,
  volunteers,
  initialValues,
  initialVolunteerIds,
  submitLabel = "Log interaction",
  savingLabel = "Saving…",
}: {
  action: Action;
  facilities: { id: string; name: string }[];
  defaultFacilityId?: string;
  /** Set when logging from a resident's page — the resident is fixed
   * and shown as plain text rather than a picker. */
  fixedResident?: { id: string; name: string };
  /** Set when logging from a facility's page (no fixed resident) — an
   * optional picker limited to that facility's residents. */
  residents?: { id: string; name: string }[];
  /** Any contact this interaction is with directly (e.g., a facility
   * staff communication, a family call) — separate from the resident. */
  contacts?: { id: string; name: string }[];
  /** Contacts with contact_type "volunteer", for the "who was
   * involved" checklist -- this is what actually links an interaction
   * to a specific volunteer, which the dashboard's volunteer-impact
   * panel reads from. */
  volunteers?: { id: string; name: string }[];
  /** Set when editing an existing interaction, to pre-fill the form
   * with its current values instead of blank/"now" defaults. */
  initialValues?: {
    facility_id: string;
    resident_id: string;
    contact_id: string;
    occurred_at: string;
    interaction_type: string;
    notes: string;
  };
  initialVolunteerIds?: string[];
  submitLabel?: string;
  savingLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState<InteractionFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const [defaultOccurredAt] = useState(() => toDatetimeLocalValue(new Date()));
  const values = state.values ??
    initialValues ?? {
      facility_id: defaultFacilityId ?? "",
      resident_id: fixedResident?.id ?? "",
      contact_id: "",
      occurred_at: defaultOccurredAt,
      interaction_type: "",
      notes: "",
    };
  const formKey = JSON.stringify(values);

  const [interactionType, setInteractionType] = useState(values.interaction_type);
  const isVolunteerVisit = interactionType === "volunteer_visit";
  const [checkedVolunteerIds, setCheckedVolunteerIds] = useState<string[]>(initialVolunteerIds ?? []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // A volunteer visit with nobody checked off is exactly the gap
    // that left the volunteer-impact report empty for months of real
    // visits -- a nudge here, not a hard block, since occasionally the
    // volunteer genuinely isn't known yet.
    if (isVolunteerVisit && checkedVolunteerIds.length === 0) {
      const proceed = window.confirm(
        "No volunteers are checked off for this volunteer visit. It won't count toward the volunteer impact report unless someone is selected. Log it anyway?"
      );
      if (!proceed) e.preventDefault();
    }
  }

  return (
    <form key={formKey} action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {fixedResident ? (
        <div className="flex flex-col gap-1.5">
          <Label>Resident</Label>
          <p className="text-sm">{fixedResident.name}</p>
          <input type="hidden" name="resident_id" value={fixedResident.id} />
        </div>
      ) : residents && residents.length > 0 ? (
        <Field label="Resident" htmlFor="resident_id" error={fieldErrors.resident_id}>
          <SelectField
            name="resident_id"
            defaultValue={values.resident_id}
            options={residents.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="General facility interaction (no specific resident)"
            allowEmpty
          />
        </Field>
      ) : null}

      <Field label="Facility" htmlFor="facility_id" error={fieldErrors.facility_id} required>
        <SelectField
          name="facility_id"
          defaultValue={values.facility_id}
          options={facilities.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Choose a facility…"
        />
      </Field>

      <Field label="Date & time" htmlFor="occurred_at" error={fieldErrors.occurred_at} required>
        <Input
          id="occurred_at"
          name="occurred_at"
          type="datetime-local"
          defaultValue={values.occurred_at}
          required
        />
      </Field>

      <Field
        label="Interaction type"
        htmlFor="interaction_type"
        error={fieldErrors.interaction_type}
        required
      >
        <SelectField
          name="interaction_type"
          value={interactionType}
          onValueChange={setInteractionType}
          options={INTERACTION_TYPES}
          placeholder="Choose a type…"
        />
      </Field>

      {contacts && contacts.length > 0 ? (
        <Field label="Contact" htmlFor="contact_id" error={fieldErrors.contact_id}>
          <SelectField
            name="contact_id"
            defaultValue={values.contact_id}
            options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="No specific contact"
            allowEmpty
          />
        </Field>
      ) : null}

      {volunteers && volunteers.length > 0 ? (
        <div
          className={
            isVolunteerVisit
              ? "flex flex-col gap-1.5 rounded-md border-2 border-primary p-3"
              : "flex flex-col gap-1.5"
          }
        >
          <Label>
            Volunteers involved
            {isVolunteerVisit ? <span className="text-destructive"> *</span> : null}
          </Label>
          {isVolunteerVisit ? (
            <p className="text-xs text-muted-foreground">
              This is what makes a volunteer visit show up in the Volunteer Impact report — check off who was there.
            </p>
          ) : null}
          <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
            {volunteers.map((v) => (
              <label key={v.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="volunteer_ids"
                  value={v.id}
                  defaultChecked={initialVolunteerIds?.includes(v.id) ?? false}
                  onChange={(e) =>
                    setCheckedVolunteerIds((prev) =>
                      e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id)
                    )
                  }
                  className="accent-primary"
                />
                {v.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Notes" htmlFor="notes" error={fieldErrors.notes}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? savingLabel : submitLabel}
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
  /** Pass value + onValueChange together to let a parent component
   * react to this field's selection (e.g. showing/requiring another
   * field based on it) instead of managing it internally. */
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
