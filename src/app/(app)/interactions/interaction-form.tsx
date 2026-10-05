"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  INTERACTION_TYPES,
  FACILITY_OPTIONAL_TYPES,
  GROUP_VISIT_TYPES,
  OCCASIONS,
  PROGRAM_PARTNERS,
  UNMET_NEED_REASONS,
  TIME_SPENT_OPTIONS,
  SERVICE_FIELDS_BY_TYPE,
  type InteractionType,
} from "@/lib/domain/interaction";
import type { InteractionFormState } from "@/lib/actions/interactions";
import { toOrgDatetimeLocalValue } from "@/lib/format-date";

type Action = (
  state: InteractionFormState,
  formData: FormData
) => Promise<InteractionFormState>;

export function InteractionForm({
  action,
  facilities,
  defaultFacilityId,
  defaultInteractionType,
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
  /** Pre-selects the type for a new entry, such as Resident visit. */
  defaultInteractionType?: string;
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
  } & Partial<ServiceFormValues>;
  initialVolunteerIds?: string[];
  submitLabel?: string;
  savingLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState<InteractionFormState, FormData>(action, {
    error: null,
  });
  const fieldErrors = state.fieldErrors ?? {};
  // "Now" in Cleveland time -- computed the same way on the server and in
  // the browser, so the pre-filled time is right even though the page is
  // first rendered on a server running in UTC.
  const [defaultOccurredAt] = useState(() => toOrgDatetimeLocalValue(new Date()));
  const values = state.values ??
    initialValues ?? {
      facility_id: defaultFacilityId ?? "",
      resident_id: fixedResident?.id ?? "",
      contact_id: "",
      occurred_at: defaultOccurredAt,
      interaction_type: defaultInteractionType ?? "",
      notes: "",
    };
  const formKey = JSON.stringify(values);

  const [interactionType, setInteractionType] = useState(values.interaction_type);
  const isVolunteerVisit = interactionType === "volunteer_visit";
  const facilityRequired = !FACILITY_OPTIONAL_TYPES.includes(interactionType);
  const serviceFields = SERVICE_FIELDS_BY_TYPE[interactionType as InteractionType] ?? [];
  const service: ServiceFormValues = { ...EMPTY_SERVICE_VALUES, ...values };
  const [unmetNeed, setUnmetNeed] = useState(service.unmet_need === "on");
  // On a failed submit (e.g. a missing Facility), state.checkedVolunteerIds
  // carries back what was actually checked, so re-picking volunteers isn't
  // lost along with the rest of the form -- only fall back to the
  // originally-saved list (or none, for a new interaction) on first mount.
  const [checkedVolunteerIds, setCheckedVolunteerIds] = useState<string[]>(
    state.checkedVolunteerIds ?? initialVolunteerIds ?? []
  );

  function handleInteractionTypeChange(next: string) {
    setInteractionType(next);
    // The checklist is only meant to apply to volunteer visits -- if it
    // stayed checked after switching away, saving would silently link
    // those volunteers to an interaction that isn't a volunteer visit.
    if (next !== "volunteer_visit") setCheckedVolunteerIds([]);
  }

  // One random ID for everything typed into this form, kept across
  // failed attempts, so the server can recognize a repeat of the same
  // save (double tap, or a retry after a dropped connection) and never
  // store the visit twice. Created on first submit, in the browser.
  const submissionIdRef = useRef<string | null>(null);

  // Warn before leaving the page (closing the tab, refreshing, the
  // browser's Back button) while there are typed-in changes that
  // haven't been saved yet.
  const [isDirty, setIsDirty] = useState(false);
  useEffect(() => {
    if (!isDirty || isPending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, isPending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Already saving -- ignore a second tap rather than queueing a
    // second save behind the first.
    if (isPending) {
      e.preventDefault();
      return;
    }
    // A volunteer visit with nobody checked off is exactly the gap
    // that left the volunteer-impact report empty for months of real
    // visits -- a nudge here, not a hard block, since occasionally the
    // volunteer genuinely isn't known yet.
    if (isVolunteerVisit && checkedVolunteerIds.length === 0) {
      const proceed = window.confirm(
        "No volunteers are checked off for this volunteer visit. It won't count toward the volunteer impact report unless someone is selected. Log it anyway?"
      );
      if (!proceed) {
        e.preventDefault();
        return;
      }
    }
    submissionIdRef.current ??= crypto.randomUUID();
    const idField = e.currentTarget.elements.namedItem("client_submission_id");
    if (idField instanceof HTMLInputElement) idField.value = submissionIdRef.current;
  }

  return (
    <form
      key={formKey}
      action={formAction}
      onSubmit={handleSubmit}
      onChange={() => setIsDirty(true)}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="client_submission_id" defaultValue="" />
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
        >
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

      <Field label="Facility" htmlFor="facility_id" error={fieldErrors.facility_id} required={facilityRequired}>
        <SelectField
          name="facility_id"
          defaultValue={values.facility_id}
          options={facilities.map((f) => ({ value: f.id, label: f.name }))}
          placeholder={facilityRequired ? "Choose a facility…" : "No facility yet"}
          allowEmpty={!facilityRequired}
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
          onValueChange={handleInteractionTypeChange}
          options={INTERACTION_TYPES}
          placeholder="Choose a type…"
        />
      </Field>

      {serviceFields.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/40 p-3 sm:grid-cols-2">
          {serviceFields.includes("program_partner") ? (
            <Field label="School or shul?" htmlFor="program_partner" error={fieldErrors.program_partner}>
              <SelectField
                name="program_partner"
                defaultValue={service.program_partner}
                options={PROGRAM_PARTNERS}
                placeholder="Choose…"
              />
            </Field>
          ) : null}
          {serviceFields.includes("occasion") ? (
            <Field label="Occasion" htmlFor="occasion" error={fieldErrors.occasion}>
              <SelectField name="occasion" defaultValue={service.occasion} options={OCCASIONS} placeholder="Choose…" />
            </Field>
          ) : null}
          {serviceFields.includes("quantity") ? (
            <NumberField
              name="quantity"
              label="How many items?"
              hint="e.g. 12 challahs, 30 meals — what they were goes in the notes"
              defaultValue={service.quantity}
              error={fieldErrors.quantity}
            />
          ) : null}
          {serviceFields.includes("participants") ? (
            <NumberField
              name="participants"
              label="Students / shul members who took part"
              defaultValue={service.participants}
              error={fieldErrors.participants}
            />
          ) : null}
          {serviceFields.includes("people_reached") ? (
            <NumberField
              name="people_reached"
              label="Residents reached (about)"
              hint={
                GROUP_VISIT_TYPES.includes(interactionType)
                  ? "Only for a group visit — leave blank when it's one person"
                  : "A rough count is fine"
              }
              defaultValue={service.people_reached}
              error={fieldErrors.people_reached}
            />
          ) : null}
        </div>
      ) : null}

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
            {isVolunteerVisit ? <span className="text-muted-foreground"> (recommended)</span> : null}
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
                  checked={checkedVolunteerIds.includes(v.id)}
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

      <Field label="Time spent" htmlFor="minutes_spent" error={fieldErrors.minutes_spent}>
        <SelectField
          name="minutes_spent"
          defaultValue={service.minutes_spent}
          options={withCurrentOption(TIME_SPENT_OPTIONS, service.minutes_spent)}
          placeholder="Not recorded"
          allowEmpty
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-md border border-border p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="unmet_need"
            checked={unmetNeed}
            onChange={(e) => setUnmetNeed(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="font-medium">We couldn&apos;t fully meet this request</span>
            <span className="block text-xs text-muted-foreground">
              Counted in the funder report as need we had to turn away.
            </span>
          </span>
        </label>
        {unmetNeed ? (
          <Field label="Why not?" htmlFor="unmet_need_reason" error={fieldErrors.unmet_need_reason}>
            <SelectField
              name="unmet_need_reason"
              defaultValue={service.unmet_need_reason}
              options={UNMET_NEED_REASONS}
              placeholder="Choose a reason…"
            />
          </Field>
        ) : null}
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="funder_story"
            defaultChecked={service.funder_story === "on"}
            className="mt-0.5 accent-primary"
          />
          <span>
            <span className="font-medium">Good story for funders</span>
            <span className="block text-xs text-muted-foreground">
              Flags these notes to share (without names) at report time.
            </span>
          </span>
        </label>
      </div>

      {state.error ? (
        <p className="text-sm font-medium text-destructive">Not saved yet — see the message at the top of the form.</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
          {isPending ? savingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** The service-field values as the form handles them: strings, with
 * checkboxes as "on" or "" -- the same shape a submitted FormData echoes
 * back on a failed save. */
export type ServiceFormValues = {
  occasion: string;
  program_partner: string;
  quantity: string;
  people_reached: string;
  participants: string;
  minutes_spent: string;
  unmet_need: string;
  unmet_need_reason: string;
  funder_story: string;
};

const EMPTY_SERVICE_VALUES: ServiceFormValues = {
  occasion: "",
  program_partner: "",
  quantity: "",
  people_reached: "",
  participants: "",
  minutes_spent: "",
  unmet_need: "",
  unmet_need_reason: "",
  funder_story: "",
};

/** Keeps a saved value selectable even if it isn't one of the standard
 * dropdown choices, so re-saving an entry never silently drops it. */
function withCurrentOption(options: readonly { value: string; label: string }[], current: string) {
  if (!current || options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: `${current} minutes` }];
}

function NumberField({
  name,
  label,
  hint,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <Field label={label} htmlFor={name} error={error}>
      <Input id={name} name={name} type="number" inputMode="numeric" min={0} step={1} defaultValue={defaultValue} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Field>
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
