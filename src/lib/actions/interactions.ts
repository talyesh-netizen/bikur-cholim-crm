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
  occasionForHoliday,
  type InteractionType,
} from "@/lib/domain/interaction";
import { orgLocalToIso } from "@/lib/format-date";
import { withSaved } from "@/lib/saved-flash";

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
};

const interactionSchema = z
  .object({
    resident_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    contact_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    facility_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    occurred_at: z
      .string()
      .min(1, "Please enter a date and time.")
      .refine((v) => orgLocalToIso(v) !== null, "Please enter a valid date and time."),
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
  })
  .superRefine((data, ctx) => {
    if (!data.facility_id && !FACILITY_OPTIONAL_TYPES.includes(data.interaction_type)) {
      ctx.addIssue({ code: "custom", path: ["facility_id"], message: "Please choose a facility." });
    }
  });

/** The row to save: every optional service field the chosen type
 * doesn't ask about is cleared (null), so an entry whose type was
 * changed -- e.g. from a food delivery to a phone call -- can't keep
 * counting its old quantity in the impact report. */
function toInteractionRow(data: z.infer<typeof interactionSchema>) {
  const applies = SERVICE_FIELDS_BY_TYPE[data.interaction_type as InteractionType] ?? [];
  const pick = <K extends (typeof applies)[number]>(key: K) => (applies.includes(key) ? data[key] ?? null : null);
  const holiday = HOLIDAY_TYPES.includes(data.interaction_type) ? data.holiday ?? null : null;
  // The holiday now drives the older Shabbos / Yom Tov occasion (used by
  // the funder report); with no holiday, any occasion already saved on
  // the entry is kept.
  const occasion = applies.includes("occasion") ? occasionForHoliday(holiday) ?? data.occasion ?? null : null;
  return {
    resident_id: data.resident_id ?? null,
    contact_id: data.contact_id ?? null,
    facility_id: data.facility_id ?? null,
    // The form's date & time box has no timezone of its own -- what was
    // typed is Cleveland time. Reading it with `new Date()` here would
    // treat it as the server's timezone (UTC on Vercel) and shift every
    // visit by 4-5 hours.
    occurred_at: orgLocalToIso(data.occurred_at)!,
    interaction_type: data.interaction_type,
    notes: data.notes ?? null,
    occasion,
    holiday,
    family_need: FAMILY_NEED_TYPES.includes(data.interaction_type) ? data.family_need ?? null : null,
    program_partner: pick("program_partner"),
    quantity: pick("quantity"),
    people_reached: pick("people_reached"),
    participants: pick("participants"),
    minutes_spent: data.minutes_spent ?? null,
    unmet_need: data.unmet_need,
    unmet_need_reason: data.unmet_need ? data.unmet_need_reason ?? null : null,
    funder_story: data.funder_story,
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

// A random ID the form sends with each save, so a double tap or a retry
// after a dropped connection can't create the same visit twice -- see
// the interaction_submission_id migration.
const submissionIdSchema = z.string().uuid();

export async function createInteraction(
  redirectTo: string,
  _prevState: InteractionFormState,
  formData: FormData
): Promise<InteractionFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const volunteerIds = formData.getAll("volunteer_ids") as string[];
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw, checkedVolunteerIds: volunteerIds };
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

  const { data: created, error } = await supabase
    .from("interactions")
    .insert({
      ...toInteractionRow(parsed.data),
      staff_member_id: user.id,
      client_submission_id: clientSubmissionId,
    })
    .select("id")
    .single();

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
      if (parsed.data.resident_id) revalidatePath(`/residents/${parsed.data.resident_id}`);
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
    };
  }

  if (volunteerIds.length > 0) {
    const volunteerError = await saveInteractionVolunteers(supabase, created.id, volunteerIds);
    if (volunteerError) {
      // The interaction row itself is already saved at this point --
      // re-showing the "create" form here (as the other error returns
      // do) would let a retry create a second, duplicate interaction.
      // Send them to edit the one that was actually created instead.
      redirect(`/interactions/${created.id}/edit?volunteersError=1`);
    }
  }

  if (parsed.data.resident_id) revalidatePath(`/residents/${parsed.data.resident_id}`);
  if (parsed.data.facility_id) revalidatePath(`/facilities/${parsed.data.facility_id}`);
  // A clear "Visit logged" on the page it lands on (e.g. back on site).
  redirect(withSaved(redirectTo, parsed.data.interaction_type === "resident_visit" ? "visit-logged" : "interaction-logged", created.id));
}

export async function updateInteraction(
  id: string,
  redirectTo: string,
  _prevState: InteractionFormState,
  formData: FormData
): Promise<InteractionFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const volunteerIds = formData.getAll("volunteer_ids") as string[];
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw, checkedVolunteerIds: volunteerIds };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again.", values: raw, checkedVolunteerIds: volunteerIds };
  }

  const { data: updated, error } = await supabase
    .from("interactions")
    .update({
      ...toInteractionRow(parsed.data),
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
  redirect(redirectTo);
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
