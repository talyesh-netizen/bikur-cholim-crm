"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";
import { capitalizeOptional, capitalizeWords } from "@/lib/format-text";

const statusValues = RESIDENT_STATUSES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export type ResidentFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // See the matching comment in lib/actions/facilities.ts — echoes back
  // what was typed so a failed save never silently discards it.
  values?: Record<string, string>;
};

// current_facility_id is intentionally NOT part of this schema. A new
// resident is assigned a facility at creation time (handled separately
// below), but once created, moving them to a different facility only
// ever happens through the dedicated transfer workflow (see
// lib/actions/transfer-resident.ts) — never through this general-purpose
// edit form. That keeps "move a resident" a single, well-defined action
// with its own history-preserving side effects, rather than something
// that can happen as a side effect of an unrelated edit.
const residentSchema = z.object({
  // Either name may be unknown -- saved as blank (null), never guessed.
  // At least one of the two is required (checked below and in the database).
  first_name: optionalText().transform((v) => (v ? capitalizeWords(v) : null)),
  last_name: optionalText().transform((v) => (v ? capitalizeWords(v) : null)),
  preferred_name: optionalText().transform(capitalizeOptional),
  room_number: optionalText(),
  phone_number: optionalText(),
  // null (not undefined) so choosing "Not recorded" on edit actually clears it.
  sex: z.preprocess(emptyToUndefined, z.enum(["male", "female"]).optional()).transform((v) => v ?? null),
  rabbi_synagogue_connection: optionalText(),
  jewish_interests_background: optionalText(),
  kosher_food_needs: optionalText(),
  holiday_support_needs: optionalText(),
  visitation_needs: optionalText(),
  preferred_visit_frequency: optionalText(),
  status: z.enum(statusValues),
  referral_source: optionalText(),
  private_internal_notes: optionalText(),
});

function hasAName(r: { first_name: string | null; last_name: string | null }) {
  return !!(r.first_name || r.last_name);
}
const NAME_REQUIRED = { message: "Please enter a first or last name.", path: ["first_name"] };

// Only used when creating a new resident. The facility may be left blank
// when the resident's current location is genuinely unknown -- we never
// guess one. It can be set later with the transfer workflow.
const createResidentSchema = residentSchema
  .extend({
    current_facility_id: z.preprocess(emptyToUndefined, z.string().uuid("Please choose a facility.").optional()),
  })
  .refine(hasAName, NAME_REQUIRED);

function parseResidentForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return { raw, result: residentSchema.refine(hasAName, NAME_REQUIRED).safeParse(raw) };
}

function flattenErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function createResident(
  _prevState: ResidentFormState,
  formData: FormData
): Promise<ResidentFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = createResidentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: flattenErrors(parsed.error),
      values: raw,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("residents")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Something went wrong saving this resident. Please try again.", values: raw };
  }

  revalidatePath("/residents");
  if (parsed.data.current_facility_id) revalidatePath(`/facilities/${parsed.data.current_facility_id}`);
  redirect(`/residents/${data.id}`);
}

export async function updateResident(
  residentId: string,
  _prevState: ResidentFormState,
  formData: FormData
): Promise<ResidentFormState> {
  const { raw, result: parsed } = parseResidentForm(formData);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: flattenErrors(parsed.error),
      values: raw,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("residents").update(parsed.data).eq("id", residentId).select("id");

  if (error) {
    return { error: "Something went wrong saving this resident. Please try again.", values: raw };
  }
  // Access rules turn a disallowed update into "0 rows changed", not an
  // error -- never let that look like a successful save.
  if (!updated || updated.length === 0) {
    return { error: "Changes NOT saved: this record no longer exists or you don't have access to it.", values: raw };
  }

  revalidatePath("/residents");
  revalidatePath(`/residents/${residentId}`);
  redirect(`/residents/${residentId}`);
}
