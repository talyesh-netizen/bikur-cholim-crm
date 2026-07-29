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
}) {
  const [state, formAction, isPending] = useActionState<InteractionFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  const [defaultOccurredAt] = useState(() => toDatetimeLocalValue(new Date()));
  const values = state.values ?? {
    facility_id: defaultFacilityId ?? "",
    resident_id: fixedResident?.id ?? "",
    occurred_at: defaultOccurredAt,
    interaction_type: "",
    notes: "",
  };
  const formKey = JSON.stringify(values);

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-4">
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
          defaultValue={values.interaction_type}
          options={INTERACTION_TYPES}
          placeholder="Choose a type…"
        />
      </Field>

      <Field label="Notes" htmlFor="notes" error={fieldErrors.notes}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Log interaction"}
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
