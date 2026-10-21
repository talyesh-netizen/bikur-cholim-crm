"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  INTERACTION_TYPES,
  FACILITY_OPTIONAL_TYPES,
  OCCASIONS,
  PROGRAM_PARTNERS,
  UNMET_NEED_REASONS,
  SERVICE_FIELDS_BY_TYPE,
  HOLIDAYS,
  HOLIDAY_TYPES,
  FAMILY_NEEDS,
  FAMILY_NEED_TYPES,
  ENGAGEMENT_TYPES,
  PARTNER_TYPES,
  METHOD_ASKED,
  METHOD_FIXED,
  METHODS,
  methodWhere,
  occasionForHoliday,
  type InteractionType,
} from "@/lib/domain/interaction";
import { orgDateToIso } from "@/lib/format-date";
import { withSaved } from "@/lib/saved-flash";
import { saveQuarterAsFirstRecorded } from "@/lib/actions/double-entries";

const typeValues = INTERACTION_TYPES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const enumValues = (options: readonly { value: string }[]) =>
  options.map((o) => o.value) as [string, ...string[]];
const optionalCount = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int("Please enter a whole number.").min(0, "Can't be negative.").max(100000).optional()
);

export type InteractionFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back what was typed so a failed save never silently discards
  // it — same pattern as lib/actions/facilities.ts and residents.ts.
  values?: Record<string, string>;
  // Same idea for the "Volunteers involved" checkboxes -- formData only
  // keeps a single value per key, so this can't live in `values` above.
  checkedVolunteerIds?: string[];
  /** Same again for who did it and the staff linked (several each). */
  people?: PeopleChoice;
  /** And the residents picked on a Visit (several allowed). */
  residentIds?: string[];
};

/** Who did an activity and who was there, as chosen on the form. */
export type PeopleChoice = {
  /** First = lead (staff_member_id); the rest are team members. */
  doneBy: string[];
  /** Staff actually worked with or spoken to -- each counts once. */
  engaged: string[];
  /** Linked but not counted. */
  present: string[];
};

const uuidList = (values: FormDataEntryValue[]) =>
  [...new Set(values.map(String).filter((v) => z.string().uuid().safeParse(v).success))];

function readPeople(formData: FormData): PeopleChoice {
  return {
    doneBy: uuidList(formData.getAll("done_by_ids")),
    engaged: uuidList(formData.getAll("engaged_contact_ids")),
    present: uuidList(formData.getAll("present_contact_ids")),
  };
}

const interactionSchema = z
  .object({
    resident_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    contact_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    facility_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    occurred_at: z
      .string()
      .min(1, "Please enter the date.")
      .refine((v) => orgDateToIso(v) !== null, "Please enter a valid date."),
    // Editing: the moment already saved, kept when the day isn't changed.
    occurred_at_saved: z.preprocess(emptyToUndefined, z.string().optional()),
    interaction_type: z.enum(typeValues),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    occasion: z.preprocess(emptyToUndefined, z.enum(enumValues(OCCASIONS)).optional()),
    holiday: z.preprocess(emptyToUndefined, z.enum(enumValues(HOLIDAYS)).optional()),
    family_need: z.preprocess(emptyToUndefined, z.enum(enumValues(FAMILY_NEEDS)).optional()),
    program_partner: z.preprocess(emptyToUndefined, z.enum(enumValues(PROGRAM_PARTNERS)).optional()),
    quantity: optionalCount,
    people_reached: optionalCount,
    participants: optionalCount,
    minutes_spent: optionalCount,
    unmet_need: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    unmet_need_reason: z.preprocess(emptyToUndefined, z.enum(enumValues(UNMET_NEED_REASONS)).optional()),
    funder_story: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    // How it happened, where the form asks (blank = not recorded).
    method: z.preprocess(emptyToUndefined, z.enum(enumValues(METHODS)).optional()),
    partner_organization_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    part_of_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  })
  .superRefine((data, ctx) => {
    if (!data.facility_id && !FACILITY_OPTIONAL_TYPES.includes(data.interaction_type)) {
      ctx.addIssue({ code: "custom", path: ["facility_id"], message: "Please choose a facility." });
    }
    if (data.method === "in_person" && !data.facility_id && data.interaction_type in METHOD_ASKED) {
      ctx.addIssue({
        code: "custom",
        path: ["method"],
        message: "“In person at facility” needs a facility. Choose the facility, or pick “In person elsewhere”.",
      });
    }
  });

/** The row to save: every optional service field the chosen type
 * doesn't ask about is cleared (null), so an entry whose type was
 * changed -- e.g. from a food delivery to a phone call -- can't keep
 * counting its old quantity in the impact report. */
function toInteractionRow(data: z.infer<typeof interactionSchema>, people: PeopleChoice, isNew: boolean) {
  const applies = SERVICE_FIELDS_BY_TYPE[data.interaction_type as InteractionType] ?? [];
  const partnered = PARTNER_TYPES.includes(data.interaction_type);
  const partOf = partnered ? data.part_of_id ?? null : null;
  // Staff engagements are picked as a list; the first one is also the
  // entry's own contact, so older pages and reports keep showing it.
  const contactId = ENGAGEMENT_TYPES.includes(data.interaction_type) ? people.engaged[0] ?? null : data.contact_id ?? null;
  const pick = <K extends (typeof applies)[number]>(key: K) => (applies.includes(key) ? data[key] ?? null : null);
  const holiday = HOLIDAY_TYPES.includes(data.interaction_type) ? data.holiday ?? null : null;
  // The holiday now drives the older Shabbos / Yom Tov occasion (used by
  // the funder report); with no holiday, any occasion already saved on
  // the entry is kept.
  const occasion = applies.includes("occasion") ? occasionForHoliday(holiday) ?? data.occasion ?? null : null;
  return {
    resident_id: data.resident_id ?? null,
    contact_id: contactId,
    facility_id: data.facility_id ?? null,
    // The form asks for the day only (a Cleveland calendar day); see
    // orgDateToIso for the moment saved.
    occurred_at: orgDateToIso(data.occurred_at, data.occurred_at_saved)!,
    interaction_type: data.interaction_type,
    notes: data.notes ?? null,
    occasion,
    holiday,
    family_need: FAMILY_NEED_TYPES.includes(data.interaction_type) ? data.family_need ?? null : null,
    program_partner: pick("program_partner"),
    quantity: pick("quantity"),
    people_reached: pick("people_reached"),
    // Part of a group project: its volunteers are counted on the
    // project's first activity, never again here.
    participants: partOf ? null : pick("participants"),
    partner_organization_id: partnered ? data.partner_organization_id ?? null : null,
    part_of_id: partOf,
    minutes_spent: data.minutes_spent ?? null,
    unmet_need: data.unmet_need,
    unmet_need_reason: data.unmet_need ? data.unmet_need_reason ?? null : null,
    funder_story: data.funder_story,
    // How it happened: what the form asked, else the one way this kind
    // of entry can happen -- for a NEW entry only. Editing an older entry
    // that never had one leaves it "not recorded" (director, Oct 21, 2026).
    // A program or school event with no facility was in person
    // elsewhere, never a facility visit.
    ...(data.interaction_type in METHOD_ASKED
      ? { method: data.method ?? null }
      : isNew && METHOD_FIXED[data.interaction_type as InteractionType]
        ? { method: methodWhere(METHOD_FIXED[data.interaction_type as InteractionType], data.facility_id) }
        : {}),
  };
}

/** Replaces the set of volunteers linked to an interaction, as one
 * all-or-nothing database call (set_interaction_volunteers) -- so a
 * failure part-way can never leave the visit with its old volunteers
 * removed and the new ones missing. */
async function saveInteractionVolunteers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interactionId: string,
  volunteerIds: string[]
) {
  const { error } = await supabase.rpc("set_interaction_volunteers", {
    p_interaction_id: interactionId,
    p_contact_ids: volunteerIds,
  });
  return error;
}

/** Saves who else did it (team) and the staff linked, in one
 * all-or-nothing call (set_interaction_people). */
async function saveInteractionPeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interactionId: string,
  lead: string,
  people: PeopleChoice
) {
  const { error } = await supabase.rpc("set_interaction_people", {
    p_interaction_id: interactionId,
    p_engaged_contact_ids: people.engaged,
    p_present_contact_ids: people.present,
    p_team_profile_ids: people.doneBy.filter((id) => id !== lead),
  });
  return error;
}

/** "Part of" always points at the project's first activity (the one
 * holding the volunteer count), even if an in-between one was picked. */
async function projectRoot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partOfId: string | undefined,
  selfId?: string
): Promise<string | undefined> {
  if (!partOfId || partOfId === selfId) return undefined;
  const { data } = await supabase.from("interactions").select("id, part_of_id").eq("id", partOfId).maybeSingle();
  if (!data) return undefined;
  const root = (data.part_of_id as string | null) ?? (data.id as string);
  return root === selfId ? undefined : root;
}

// A random ID the form sends with each save, so a double tap or a retry
// after a dropped connection can't create the same visit twice -- see
// the interaction_submission_id migration.
const submissionIdSchema = z.string().uuid();

const RESIDENT_REQUIRED_MESSAGE = "Please choose the resident.";

/** Entries that are specifically with one resident must name them
 * (director, Oct 20 and 21, 2026). Not facility visits, staff, programs
 * or anything else; not a group visit counted with "Residents reached";
 * and an older entry saved without one can still be edited as it is. */
const RESIDENT_REQUIRED_TYPES: readonly string[] = ["resident_visit", "resident_phone_call"];
function missingResident(
  data: { interaction_type: string; resident_id?: string; people_reached?: number },
  residentChosen: boolean,
  savedWithoutResident = false
) {
  return (
    RESIDENT_REQUIRED_TYPES.includes(data.interaction_type) &&
    !residentChosen &&
    !(data.people_reached && data.people_reached > 0) &&
    !savedWithoutResident
  );
}

export async function createInteraction(
  redirectTo: string,
  _prevState: InteractionFormState,
  formData: FormData
): Promise<InteractionFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const volunteerIds = formData.getAll("volunteer_ids") as string[];
  const people = readPeople(formData);
  const chosenResidents = uuidList(formData.getAll("resident_ids"));
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw, checkedVolunteerIds: volunteerIds, people, residentIds: chosenResidents };
  }
  // A new visit sends its residents as a list (resident_ids).
  if (missingResident(parsed.data, !!parsed.data.resident_id || chosenResidents.length > 0)) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { resident_id: RESIDENT_REQUIRED_MESSAGE },
      values: raw,
      checkedVolunteerIds: volunteerIds,
      people,
      residentIds: chosenResidents,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again.", values: raw, checkedVolunteerIds: volunteerIds };
  }

  const submission = submissionIdSchema.safeParse(raw.client_submission_id);
  const clientSubmissionId = submission.success ? submission.data : null;
  // Who did it (first chosen) can differ from who is typing it in --
  // that is recorded automatically as entered_by.
  const lead = people.doneBy[0] ?? user.id;
  parsed.data.part_of_id = await projectRoot(supabase, parsed.data.part_of_id);

  // Several residents on one Visit (decision A1, Oct 19, 2026): a visit
  // for each, with the same day, place and notes. One insert, so either
  // all are saved or none; the submission ID on the first is enough to
  // recognize a repeat. A group head count isn't copied to each.
  const row = toInteractionRow(parsed.data, people, true);
  const residentIds = parsed.data.interaction_type === "resident_visit" ? chosenResidents : [];
  const rows =
    residentIds.length > 0
      ? residentIds.map((residentId, i) => ({
          ...row,
          resident_id: residentId,
          people_reached: residentIds.length > 1 ? null : row.people_reached,
          staff_member_id: lead,
          client_submission_id: i === 0 ? clientSubmissionId : null,
        }))
      : [{ ...row, staff_member_id: lead, client_submission_id: clientSubmissionId }];

  const { data: createdRows, error } = await supabase.from("interactions").insert(rows).select("id");
  const createdIds = (createdRows ?? []).map((r) => r.id as string);
  const created = createdIds.length === rows.length ? { id: createdIds[0] } : null;
  const touchedResidents = rows.map((r) => r.resident_id).filter((r): r is string => !!r);

  if (error?.code === "23505" && clientSubmissionId) {
    // This exact form was already saved (a double tap, or a retry after
    // the first save's reply got lost) -- the visit is in the database
    // once, which is what matters. Carry on as if this save succeeded.
    const { data: existing } = await supabase
      .from("interactions")
      .select("id")
      .eq("client_submission_id", clientSubmissionId)
      .maybeSingle();
    if (existing) {
      for (const r of touchedResidents) revalidatePath(`/residents/${r}`);
      if (parsed.data.facility_id) revalidatePath(`/facilities/${parsed.data.facility_id}`);
      redirect(redirectTo);
    }
  }

  if (error || !created) {
    return {
      error:
        error?.code === "42501"
          ? "This interaction was NOT saved: you don't have access to that facility or resident."
          : "This interaction was NOT saved -- something went wrong. Your entry is still below; please try again.",
      values: raw,
      checkedVolunteerIds: volunteerIds,
      people,
      residentIds: chosenResidents,
    };
  }

  for (const createdId of createdIds) {
    if (people.engaged.length > 0 || people.present.length > 0 || people.doneBy.some((id) => id !== lead)) {
      const peopleError = await saveInteractionPeople(supabase, createdId, lead, people);
      // Saved already -- fix the people on the edit page rather than risk
      // a second copy of the entry from a retry here.
      if (peopleError) redirect(`/interactions/${createdId}/edit?peopleError=1`);
    }

    if (volunteerIds.length > 0) {
      const volunteerError = await saveInteractionVolunteers(supabase, createdId, volunteerIds);
      if (volunteerError) {
        // The interaction row itself is already saved at this point --
        // re-showing the "create" form here (as the other error returns
        // do) would let a retry create a second, duplicate interaction.
        // Send them to edit the one that was actually created instead.
        redirect(`/interactions/${createdId}/edit?volunteersError=1`);
      }
    }
  }

  for (const r of touchedResidents) revalidatePath(`/residents/${r}`);
  if (parsed.data.facility_id) revalidatePath(`/facilities/${parsed.data.facility_id}`);
  // A clear "Visit logged" on the page it lands on (e.g. back on site).
  revalidatePath("/interactions");
  redirect(
    withSaved(
      redirectTo,
      createdIds.length > 1
        ? "visits-logged"
        : parsed.data.interaction_type === "resident_visit"
          ? "visit-logged"
          : parsed.data.interaction_type === "facility_staff_communication"
            ? "staff-talk-logged"
            : "interaction-logged",
      createdIds.length > 1 ? undefined : created.id
    )
  );
}

export async function updateInteraction(
  id: string,
  redirectTo: string,
  _prevState: InteractionFormState,
  formData: FormData
): Promise<InteractionFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const volunteerIds = formData.getAll("volunteer_ids") as string[];
  const people = readPeople(formData);
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw, checkedVolunteerIds: volunteerIds, people };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again.", values: raw, checkedVolunteerIds: volunteerIds };
  }

  if (missingResident(parsed.data, !!parsed.data.resident_id)) {
    const { data: saved } = await supabase.from("interactions").select("interaction_type, resident_id").eq("id", id).maybeSingle();
    const savedWithoutResident = !!saved && RESIDENT_REQUIRED_TYPES.includes(saved.interaction_type) && !saved.resident_id;
    if (missingResident(parsed.data, false, savedWithoutResident)) {
      return {
        error: "Please fix the highlighted fields.",
        fieldErrors: { resident_id: RESIDENT_REQUIRED_MESSAGE },
        values: raw,
        checkedVolunteerIds: volunteerIds,
        people,
      };
    }
  }

  const lead = people.doneBy[0] ?? undefined;
  parsed.data.part_of_id = await projectRoot(supabase, parsed.data.part_of_id, id);

  const { data: updated, error } = await supabase
    .from("interactions")
    .update({
      ...toInteractionRow(parsed.data, people, false),
      ...(lead ? { staff_member_id: lead } : {}),
      // Saving the full edit form counts as reviewing it -- it drops off
      // the "Review past entries" list.
      service_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  // An update the database's access rules don't allow comes back as "0
  // rows changed" rather than an error -- check for that explicitly so
  // it can never look like a successful save.
  if (error || !updated || updated.length === 0) {
    return {
      error:
        !error || error.code === "42501"
          ? "Your changes were NOT saved: this interaction no longer exists or you don't have access to it (or to the facility/resident chosen)."
          : "Your changes were NOT saved -- something went wrong. Your edits are still below; please try again.",
      values: raw,
      checkedVolunteerIds: volunteerIds,
      people,
    };
  }

  const { data: saved } = await supabase.from("interactions").select("staff_member_id").eq("id", id).single();
  const peopleError = formData.has("people_form")
    ? await saveInteractionPeople(supabase, id, (saved?.staff_member_id as string) ?? lead ?? user.id, people)
    : null;
  if (peopleError) {
    return {
      error: "The details were saved, but who did it and the staff linked were NOT updated. Please check them and save again.",
      values: raw,
      checkedVolunteerIds: volunteerIds,
      people,
    };
  }

  const volunteerError = await saveInteractionVolunteers(supabase, id, volunteerIds);
  if (volunteerError) {
    return {
      error:
        "The interaction details were saved, but the volunteers involved were NOT updated (the previous list was kept). Please check them and save again.",
      values: raw,
      checkedVolunteerIds: volunteerIds,
    };
  }

  if (parsed.data.resident_id) revalidatePath(`/residents/${parsed.data.resident_id}`);
  if (parsed.data.facility_id) revalidatePath(`/facilities/${parsed.data.facility_id}`);
  revalidatePath("/interactions");
  redirect(withSaved(redirectTo, "interaction-saved"));
}

export type ReviewFormState = { error: string | null; saved?: boolean };

const reviewSchema = z.object({
  interaction_type: z.enum(typeValues),
  occasion: z.preprocess(emptyToUndefined, z.enum(enumValues(OCCASIONS)).optional()),
  program_partner: z.preprocess(emptyToUndefined, z.enum(enumValues(PROGRAM_PARTNERS)).optional()),
  quantity: optionalCount,
  people_reached: optionalCount,
  participants: optionalCount,
});

/** One-tap save from the "Review past entries" screen: confirms (or
 * corrects) an older entry's type and the few numbers that type asks
 * about, and marks it reviewed. Everything else on the entry -- notes,
 * who, where, when -- is left untouched; the full edit form is one tap
 * away for anything more. */
export async function saveInteractionReview(
  id: string,
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the numbers entered." };
  }

  const data = parsed.data;
  const applies = SERVICE_FIELDS_BY_TYPE[data.interaction_type as InteractionType] ?? [];
  const pick = <K extends (typeof applies)[number]>(key: K) => (applies.includes(key) ? data[key] ?? null : null);

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("interactions")
    .update({
      interaction_type: data.interaction_type,
      occasion: pick("occasion"),
      program_partner: pick("program_partner"),
      quantity: pick("quantity"),
      people_reached: pick("people_reached"),
      participants: pick("participants"),
      service_reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (error || !updated || updated.length === 0) return { error: "Not saved. Please try again." };

  // Deliberately not revalidating the review page itself: that would pull
  // the row out from under the person mid-list. It shows "Saved" in
  // place instead, and is gone next time the page loads.
  revalidatePath("/data-quality");
  return { error: null, saved: true };
}

export type VoidResult = { ok: boolean; error?: string };

const VOID_REASON_MAX = 300;

/** Voids an entry made by mistake (director, Oct 21, 2026): it stays on
 * file and can be restored, but no longer counts anywhere. A reason is
 * required; who did it and when are kept in the change history. Nothing
 * is ever deleted. */
export async function voidInteraction(id: string, reason: string): Promise<VoidResult> {
  const why = reason.trim().slice(0, VOID_REASON_MAX);
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "That entry could not be found." };
  if (!why) return { ok: false, error: "Please say why this entry is being voided." };

  const supabase = await createClient();
  const { data: entry } = await supabase.from("interactions").select("occurred_at, voided_at, counted_in_id").eq("id", id).maybeSingle();
  if (!entry) return { ok: false, error: "That entry could not be found, or you don't have access to it." };
  if (entry.voided_at) return { ok: true };
  if (entry.counted_in_id) {
    return { ok: false, error: "This entry was reviewed as a double entry and already isn't counted. Undo that review first if it's wrong." };
  }
  // The quarter's totals as first recorded, saved once before its first
  // correction (only an admin can save them; a void never waits on it).
  await saveQuarterAsFirstRecorded(entry.occurred_at as string);

  const { data: updated, error } = await supabase
    .from("interactions")
    .update({ voided_at: new Date().toISOString(), void_reason: why })
    .eq("id", id)
    .select("id, resident_id, facility_id");
  if (error || !updated || updated.length === 0) return { ok: false, error: "Not voided. Please try again." };
  revalidateEntryPages(updated[0]);
  return { ok: true };
}

/** Puts a voided entry back: it counts again, exactly as before. */
export async function restoreInteraction(id: string): Promise<VoidResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "That entry could not be found." };
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("interactions")
    .update({ voided_at: null })
    .eq("id", id)
    .select("id, resident_id, facility_id");
  if (error || !updated || updated.length === 0) return { ok: false, error: "Not restored. Please try again." };
  revalidateEntryPages(updated[0]);
  return { ok: true };
}

function revalidateEntryPages(row: { id: string; resident_id: string | null; facility_id: string | null }) {
  revalidatePath(`/interactions/${row.id}`);
  revalidatePath("/interactions");
  revalidatePath("/impact");
  if (row.resident_id) revalidatePath(`/residents/${row.resident_id}`);
  if (row.facility_id) revalidatePath(`/facilities/${row.facility_id}`);
}
