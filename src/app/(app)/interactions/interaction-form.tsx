"use client";

import { FacilityPicker } from "@/components/facility-picker";
import { MultiSearchPicker, SearchPicker } from "@/components/search-picker";
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
  VOLUNTEER_TYPES,
  ENGAGEMENT_TYPES,
  PARTNER_TYPES,
  GROUP_COUNT_TYPES,
  PROGRAM_PARTNERS,
  SERVICE_FIELDS_BY_TYPE,
  TYPE_BUTTONS,
  MORE_TYPES,
  HOLIDAYS,
  HOLIDAY_TYPES,
  FOOD_KINDS,
  OFFERED_HOLIDAYS,
  foodKindFor,
  type InteractionType,
} from "@/lib/domain/interaction";
import type { InteractionFormState, PeopleChoice } from "@/lib/actions/interactions";
import type { ActivityFormOptions, GroupProjectOption } from "@/lib/queries/activity";
import { formatDateTime, toOrgDatetimeLocalValue } from "@/lib/format-date";

type Action = (
  state: InteractionFormState,
  formData: FormData
) => Promise<InteractionFormState>;

export function InteractionForm({
  action,
  facilities,
  defaultFacilityId,
  defaultInteractionType,
  defaultContactId,
  fixedResident,
  residents,
  contacts,
  volunteers,
  initialValues,
  initialVolunteerIds,
  activity,
  initialPeople,
  initialPartOf,
  selfId,
  submitLabel = "Log interaction",
  savingLabel = "Saving…",
}: {
  action: Action;
  facilities: { id: string; name: string }[];
  defaultFacilityId?: string;
  /** Pre-selects the type for a new entry, such as Resident visit. */
  defaultInteractionType?: string;
  /** Pre-selects who it was with (a staff or family member tapped on site). */
  defaultContactId?: string;
  /** Set when logging from a resident's page — the resident is fixed
   * and shown as plain text rather than a picker. */
  fixedResident?: { id: string; name: string };
  /** Set when logging from a facility's page (no fixed resident) — an
   * optional picker limited to that facility's residents. */
  residents?: { id: string; name: string; detail?: string | null }[];
  /** Any contact this interaction is with directly (e.g., a facility
   * staff communication, a family call) — separate from the resident. */
  contacts?: { id: string; name: string; detail?: string | null }[];
  /** Contacts with contact_type "volunteer", for "volunteers involved"
   * -- this is what actually links an interaction to a specific
   * volunteer, which the dashboard's volunteer-impact panel reads from. */
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
    partner_organization_id?: string;
  } & Partial<ServiceFormValues>;
  initialVolunteerIds?: string[];
  /** Staff, partners, group projects -- for who did it, staff engaged,
   * partner and "Part of" (Build 2). */
  activity?: ActivityFormOptions;
  /** Editing: who did it and the staff linked, as saved. */
  initialPeople?: PeopleChoice;
  /** Editing: the group project this entry is part of, as saved. */
  initialPartOf?: GroupProjectOption | null;
  /** Editing: this entry's own id (never suggested as its own project). */
  selfId?: string;
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
      contact_id: defaultContactId ?? "",
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
  const isFood = interactionType === "food_delivery";
  // Food asks one question -- Snack, Shabbos delivery or Holiday delivery
  // -- stored in the existing holiday field (see FOOD_KINDS).
  const [foodKind, setFoodKind] = useState(foodKindFor(service.holiday));
  const [foodHoliday, setFoodHoliday] = useState(service.holiday && service.holiday !== "shabbos" ? service.holiday : "");
  // The holidays offered: Shabbos plus the main six, and whatever an
  // older entry already has so editing it never loses it.
  const holidayOptions = HOLIDAYS.filter(
    (h) => h.value === "shabbos" || (OFFERED_HOLIDAYS as readonly string[]).includes(h.value) || h.value === service.holiday
  );
  // On a failed submit (e.g. a missing Facility), state.checkedVolunteerIds
  // carries back what was actually checked, so re-picking volunteers isn't
  // lost along with the rest of the form -- only fall back to the
  // originally-saved list (or none, for a new interaction) on first mount.
  const [checkedVolunteerIds, setCheckedVolunteerIds] = useState<string[]>(
    state.checkedVolunteerIds ?? initialVolunteerIds ?? []
  );
  // Volunteers are asked about only where they usually take part; any
  // other entry offers a small "+ Add volunteers" instead. Chosen ones
  // always stay on screen (as chips), so nothing is linked unseen.
  const [volunteersOpened, setVolunteersOpened] = useState(false);
  const showVolunteers =
    VOLUNTEER_TYPES.includes(interactionType) || checkedVolunteerIds.length > 0 || volunteersOpened;

  // Who did it: you, unless changed -- first chosen leads, the rest are
  // team members credited too. Who typed it in is recorded on its own.
  const [doneBy, setDoneBy] = useState<string[]>(
    state.people?.doneBy ?? initialPeople?.doneBy ?? (activity?.currentUserId ? [activity.currentUserId] : [])
  );
  // Staff actually worked with or spoken to (each counts once), and --
  // only when asked for -- others who were just there (not counted).
  const isEngagementType = ENGAGEMENT_TYPES.includes(interactionType);
  const [engaged, setEngaged] = useState<string[]>(
    state.people?.engaged ??
      initialPeople?.engaged ??
      (defaultContactId && ENGAGEMENT_TYPES.includes(values.interaction_type) ? [defaultContactId] : [])
  );
  const [present, setPresent] = useState<string[]>(state.people?.present ?? initialPeople?.present ?? []);
  const [presentOpened, setPresentOpened] = useState(false);

  // Partner and group project ("Part of").
  const isPartnerType = PARTNER_TYPES.includes(interactionType);
  const [partnerId, setPartnerId] = useState(values.partner_organization_id ?? "");
  const [partnerOpened, setPartnerOpened] = useState(false);
  const partnerName = activity?.partners.find((p) => p.id === partnerId)?.name ?? null;
  const [occurredAt, setOccurredAt] = useState(values.occurred_at);
  // "yes:<id>" (part of that project), "no" (a separate group), or ""
  // (not answered). Never assumed: the person has to answer.
  const [partOfAnswer, setPartOfAnswer] = useState(
    state.values?.part_of_id ? `yes:${state.values.part_of_id}` : initialPartOf ? `yes:${initialPartOf.id}` : ""
  );
  const projectSuggestion = suggestProject(activity?.groupProjects ?? [], partnerId, occurredAt, selfId);
  const partOfId = partOfAnswer.startsWith("yes:") ? partOfAnswer.slice(4) : "";
  const partOfProject =
    partOfId === initialPartOf?.id ? initialPartOf : (activity?.groupProjects ?? []).find((g) => g.id === partOfId) ?? null;
  const needsPartOfAnswer = isPartnerType && !!projectSuggestion && partOfAnswer === "";
  const [partOfPrompt, setPartOfPrompt] = useState(false);

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
        "No volunteers are added to this volunteer visit. It won't count toward the volunteer impact report unless someone is added. Log it anyway?"
      );
      if (!proceed) {
        e.preventDefault();
        return;
      }
    }
    // A suggested group project needs a yes or no -- never assumed.
    if (needsPartOfAnswer) {
      e.preventDefault();
      setPartOfPrompt(true);
      document.getElementById("part_of_question")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (activity && doneBy.length === 0) {
      e.preventDefault();
      window.alert("Please add who did it (at least one person).");
      return;
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
      {/* Tells the server this form shows who did it and the staff linked,
          so saving it replaces them (an older form leaves them alone). */}
      {activity ? <input type="hidden" name="people_form" value="1" readOnly /> : null}
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
          <SearchPicker
            id="resident_id"
            name="resident_id"
            defaultValue={values.resident_id}
            options={residents.map((r) => ({ id: r.id, label: r.name, detail: r.detail }))}
            emptyLabel="No specific resident (general facility entry)"
            placeholder="Type a resident's name…"
          />
          {interactionType === "family_communication" ? (
            <p className="text-xs text-muted-foreground">
              Whose family? Pick the resident (or the family member under Contact) so it counts toward families supported.
            </p>
          ) : null}
        </Field>
      ) : null}

      <Field label="Facility" htmlFor="facility_id" error={fieldErrors.facility_id} required={facilityRequired}>
        <FacilityPicker
          id="facility_id"
          name="facility_id"
          facilities={facilities}
          defaultValue={values.facility_id}
          emptyLabel={facilityRequired ? undefined : "No facility yet"}
        />
      </Field>

      <Field label="Date & time" htmlFor="occurred_at" error={fieldErrors.occurred_at} required>
        <Input
          id="occurred_at"
          name="occurred_at"
          type="datetime-local"
          defaultValue={values.occurred_at}
          onChange={(e) => setOccurredAt(e.target.value)}
          required
        />
      </Field>

      <Field
        label="What happened?"
        htmlFor="interaction_type"
        error={fieldErrors.interaction_type}
        required
      >
        <TypePicker value={interactionType} onChange={setInteractionType} />
      </Field>

      {/* Not asked any more (kept simple); an older entry keeps its value. */}
      <input type="hidden" name="family_need" value={service.family_need} readOnly />

      {activity && isPartnerType ? (
        interactionType === "food_delivery" && !partnerId && !partnerOpened ? (
          <button
            type="button"
            onClick={() => setPartnerOpened(true)}
            className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            + Add a partner (school, shul, group)
          </button>
        ) : (
          <Field label="Partner (optional)" htmlFor="partner_organization_id" error={fieldErrors.partner_organization_id}>
            <SearchPicker
              id="partner_organization_id"
              name="partner_organization_id"
              options={activity.partners.map((p) => ({ id: p.id, label: p.name, detail: p.detail }))}
              value={partnerId}
              onChange={(id) => {
                setPartnerId(id);
                setPartOfAnswer("");
                setPartOfPrompt(false);
              }}
              emptyLabel="No partner"
              placeholder="Type a school, shul or organization…"
            />
          </Field>
        )
      ) : null}

      {activity && isPartnerType && partOfId ? <input type="hidden" name="part_of_id" value={partOfId} readOnly /> : null}
      {activity && isPartnerType && projectSuggestion && !partOfId ? (
        <div
          id="part_of_question"
          className={
            partOfPrompt && partOfAnswer === ""
              ? "flex flex-col gap-2 rounded-md border-2 border-destructive bg-destructive/5 p-3"
              : "flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-3"
          }
        >
          <p className="text-sm font-medium">
            Part of {projectSuggestion.partner_name}&apos;s {formatDateTime(projectSuggestion.occurred_at)} project
            {projectSuggestion.facility_name ? ` at ${projectSuggestion.facility_name}` : ""} (about {projectSuggestion.participants} volunteers)?
          </p>
          {partOfPrompt && partOfAnswer === "" ? (
            <p className="text-xs font-medium text-destructive">Please answer before saving.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => setPartOfAnswer(`yes:${projectSuggestion.id}`)}>
              Yes, part of it
            </Button>
            <Button
              type="button"
              size="sm"
              variant={partOfAnswer === "no" ? "default" : "outline"}
              onClick={() => setPartOfAnswer("no")}
            >
              No, a separate group
            </Button>
          </div>
        </div>
      ) : null}
      {activity && isPartnerType && partOfId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span>
            Part of {partOfProject?.partner_name ?? "a group"}&apos;s project. Its volunteers are counted on the first activity
            {partOfProject ? (
              <>
                : {formatDateTime(partOfProject.occurred_at)}
                {partOfProject.facility_name ? ` · ${partOfProject.facility_name}` : ""} (about {partOfProject.participants})
              </>
            ) : null}
            .
          </span>
          <button type="button" onClick={() => setPartOfAnswer("no")} className="text-xs text-muted-foreground underline">
            Not part of it
          </button>
        </div>
      ) : null}

      {isFood ? (
        <Field label="What kind?" htmlFor="food_kind">
          <input type="hidden" name="holiday" value={foodKind === "snack" ? "" : foodKind === "shabbos" ? "shabbos" : foodHoliday} readOnly />
          <div id="food_kind" className="grid grid-cols-3 gap-2">
            {FOOD_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={foodKind === k.value}
                onClick={() => setFoodKind(k.value)}
                className={
                  foodKind === k.value
                    ? "rounded-md border-2 border-primary bg-primary/10 px-2 py-2.5 text-sm font-semibold"
                    : "rounded-md border border-border bg-card px-2 py-2.5 text-sm font-medium hover:border-primary/50"
                }
              >
                {k.label}
              </button>
            ))}
          </div>
          {foodKind === "holiday" ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {holidayOptions.filter((h) => h.value !== "shabbos").map((h) => (
                <button
                  key={h.value}
                  type="button"
                  aria-pressed={foodHoliday === h.value}
                  onClick={() => setFoodHoliday(h.value)}
                  className={
                    foodHoliday === h.value
                      ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      : "rounded-full bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-border"
                  }
                >
                  {h.label}
                </button>
              ))}
            </div>
          ) : null}
        </Field>
      ) : HOLIDAY_TYPES.includes(interactionType) ? (
        <Field label="For Shabbos or a holiday?" htmlFor="holiday" error={fieldErrors.holiday}>
          <SelectField
            name="holiday"
            defaultValue={service.holiday}
            options={holidayOptions}
            placeholder="No"
            allowEmpty
          />
        </Field>
      ) : null}

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
          {/* The holiday (below) now sets the Shabbos / Yom Tov occasion on
              save; an occasion already on an older entry rides along. */}
          {serviceFields.includes("occasion") ? <input type="hidden" name="occasion" value={service.occasion} readOnly /> : null}
          {isFood ? (
            // Two numbers (decision C2, Oct 16, 2026): items can differ
            // from people -- e.g. 12 challahs for 8 residents.
            <>
              <NumberField name="quantity" label="How many items?" defaultValue={service.quantity} error={fieldErrors.quantity} />
              <NumberField
                name="people_reached"
                label="How many people got one?"
                hint="A rough count is fine"
                defaultValue={service.people_reached}
                error={fieldErrors.people_reached}
              />
            </>
          ) : null}
          {serviceFields.includes("participants") &&
          !partOfId &&
          (interactionType !== "program" || partnerId || service.participants) ? (
            <NumberField
              name="participants"
              label={
                partnerName
                  ? `Volunteers from ${partnerName}: about`
                  : GROUP_COUNT_TYPES.includes(interactionType) && interactionType === "program"
                    ? "Group volunteers: about"
                    : "Students / shul members who took part"
              }
              hint={partnerName ? "Counted once for the whole project, however many facilities it reached." : undefined}
              defaultValue={service.participants}
              error={fieldErrors.participants}
            />
          ) : null}
          {serviceFields.includes("people_reached") && !isFood ? (
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

      {activity && isEngagementType ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="engaged_contact_ids">Staff you worked with or spoke to</Label>
          <MultiSearchPicker
            id="engaged_contact_ids"
            name="engaged_contact_ids"
            options={withChosen(activity.facilityStaff, activity.anyone, engaged).map((c) => ({ id: c.id, label: c.name, detail: c.detail }))}
            value={engaged}
            onChange={setEngaged}
            placeholder="Type a staff member's name…"
          />
          <p className="text-xs text-muted-foreground">Each counts once toward staff engagements.</p>
          {present.length > 0 || presentOpened ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <Label htmlFor="present_contact_ids">Others who were there (not counted)</Label>
              <MultiSearchPicker
                id="present_contact_ids"
                name="present_contact_ids"
                options={activity.anyone
                  .filter((c) => !engaged.includes(c.id))
                  .map((c) => ({ id: c.id, label: c.name, detail: c.detail }))}
                value={present}
                onChange={setPresent}
                placeholder="Type a name…"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPresentOpened(true)}
              className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              + Others who were there (not counted)
            </button>
          )}
        </div>
      ) : contacts && contacts.length > 0 ? (
        <Field label={interactionType === "volunteer_meeting" ? "Volunteer you met" : "Contact"} htmlFor="contact_id" error={fieldErrors.contact_id}>
          <SearchPicker
            id="contact_id"
            name="contact_id"
            defaultValue={values.contact_id}
            options={contacts.map((c) => ({ id: c.id, label: c.name, detail: c.detail }))}
            emptyLabel="No specific contact"
            placeholder="Type a name…"
          />
        </Field>
      ) : null}

      {volunteers && volunteers.length > 0 ? (
        showVolunteers ? (
          <div
            className={
              isVolunteerVisit
                ? "flex flex-col gap-1.5 rounded-md border-2 border-primary p-3"
                : "flex flex-col gap-1.5"
            }
          >
            <Label htmlFor="volunteer_ids">
              Volunteers involved
              {isVolunteerVisit ? <span className="text-muted-foreground"> (recommended)</span> : null}
            </Label>
            {isVolunteerVisit ? (
              <p className="text-xs text-muted-foreground">
                This is what makes a volunteer visit show up in the Volunteer Impact report — add who was there.
              </p>
            ) : null}
            <MultiSearchPicker
              id="volunteer_ids"
              name="volunteer_ids"
              options={volunteers.map((v) => ({ id: v.id, label: v.name }))}
              value={checkedVolunteerIds}
              onChange={setCheckedVolunteerIds}
              placeholder="Type a volunteer's name to add…"
            />
          </div>
        ) : (
          <button type="button" onClick={() => setVolunteersOpened(true)} className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline">
            + Add volunteers
          </button>
        )
      ) : null}

      {activity ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="done_by_ids">Done by</Label>
          <MultiSearchPicker
            id="done_by_ids"
            name="done_by_ids"
            options={activity.staff.map((s) => ({
              id: s.id,
              label: s.id === activity.currentUserId ? `${s.name} (you)` : s.name,
            }))}
            value={doneBy}
            onChange={setDoneBy}
            placeholder="Add a colleague who was there…"
          />
          <p className="text-xs text-muted-foreground">Everyone here gets credit; the activity still counts once.</p>
        </div>
      ) : null}

      <Field label="Notes" htmlFor="notes" error={fieldErrors.notes}>
        <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
        <p className="text-xs text-muted-foreground">
          About this visit or call only. Lasting facts (like &ldquo;hard of hearing&rdquo;) go in Profile notes on their page.
        </p>
      </Field>

      {/* No longer asked (kept simple); an older entry keeps what it had. */}
      <input type="hidden" name="minutes_spent" value={service.minutes_spent} readOnly />
      {service.unmet_need === "on" ? <input type="hidden" name="unmet_need" value="on" readOnly /> : null}
      <input type="hidden" name="unmet_need_reason" value={service.unmet_need_reason} readOnly />
      {service.funder_story === "on" ? <input type="hidden" name="funder_story" value="on" readOnly /> : null}

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
  holiday: string;
  family_need: string;
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
  holiday: "",
  family_need: "",
  program_partner: "",
  quantity: "",
  people_reached: "",
  participants: "",
  minutes_spent: "",
  unmet_need: "",
  unmet_need_reason: "",
  funder_story: "",
};

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

/** The simple type picker: 8 big buttons, a short follow-up for the two
 * that cover more than one kind, and "More types" for the rest. An older
 * entry whose type isn't offered any more still shows (and keeps) it. */
function TypePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const activeButton = TYPE_BUTTONS.find((b) => b.choices.some((c) => c.value === value));
  const isMoreType = !activeButton && value !== "";
  const [showMore, setShowMore] = useState(isMoreType);
  const moreOptions = INTERACTION_TYPES.filter(
    (t) => (MORE_TYPES as readonly string[]).includes(t.value) || t.value === value
  ).filter((t) => !TYPE_BUTTONS.some((b) => b.choices.some((c) => c.value === t.value)));

  const pill = (selected: boolean) =>
    selected
      ? "rounded-md border-2 border-primary bg-primary/10 px-3 py-2.5 text-sm font-semibold text-foreground"
      : "rounded-md border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary/50";

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="interaction_type" value={value} readOnly />
      <div id="interaction_type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPE_BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            aria-pressed={activeButton?.key === b.key}
            className={pill(activeButton?.key === b.key)}
            onClick={() => onChange(activeButton?.key === b.key ? value : b.choices[0].value)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {activeButton && activeButton.choices.length > 1 ? (
        <div className="flex flex-wrap gap-2 rounded-md bg-muted/40 p-2">
          {activeButton.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={value === c.value}
              className={
                value === c.value
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
              }
              onClick={() => onChange(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {showMore ? (
        <div className="flex flex-wrap gap-2">
          {moreOptions.map((t) => (
            <button key={t.value} type="button" aria-pressed={value === t.value} className={pill(value === t.value)} onClick={() => onChange(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : moreOptions.length > 0 ? (
        <button type="button" className="w-fit text-xs text-muted-foreground underline" onClick={() => setShowMore(true)}>
          More types…
        </button>
      ) : null}
    </div>
  );
}

/** The closest group project (same partner, within a week of this
 * activity's date) to offer as "Part of" -- only offered, never assumed. */
function suggestProject(
  projects: GroupProjectOption[],
  partnerId: string,
  occurredAt: string,
  selfId?: string
): GroupProjectOption | null {
  if (!partnerId || !occurredAt) return null;
  const at = Date.parse(occurredAt);
  if (Number.isNaN(at)) return null;
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  return (
    projects
      .filter((p) => p.partner_organization_id === partnerId && p.id !== selfId && Math.abs(Date.parse(p.occurred_at) - at) <= WEEK)
      .sort((a, b) => Math.abs(Date.parse(a.occurred_at) - at) - Math.abs(Date.parse(b.occurred_at) - at))[0] ?? null
  );
}

/** A picker's options plus anyone already chosen who isn't in them
 * (e.g. a contact chosen before who isn't listed as facility staff). */
function withChosen<T extends { id: string }>(options: T[], everyone: T[], chosen: string[]): T[] {
  const missing = chosen.filter((id) => !options.some((o) => o.id === id));
  return [...options, ...everyone.filter((o) => missing.includes(o.id))];
}
