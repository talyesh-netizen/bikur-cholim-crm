"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RESIDENT_STATUSES } from "@/lib/domain/resident";

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
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  preferred_name: optionalText(),
  room_number: optionalText(),
  phone_number: optionalText(),
  rabbi_synagogue_connection: optionalText(),
  jewish_interests_background: optionalText(),
  kosher_food_needs: optionalText(),
  holiday_support_needs: optionalText(),
  visitation_needs: optionalText(),
  preferred_visit_frequency: optionalText(),
  status: z.enum(statusValues),
  private_internal_notes: optionalText(),
});

// Only used when creating a new resident, who must be assigned to a
// facility from the start.
const createResidentSchema = residentSchema.extend({
  current_facility_id: z.string().uuid("Please choose a facility."),
});

function parseResidentForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return { raw, result: residentSchema.safeParse(raw) };
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
  revalidatePath(`/facilities/${parsed.data.current_facility_id}`);
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
  const { error } = await supabase.from("residents").update(parsed.data).eq("id", residentId);

  if (error) {
    return { error: "Something went wrong saving this resident. Please try again.", values: raw };
  }

  revalidatePath("/residents");
  revalidatePath(`/residents/${residentId}`);
  redirect(`/residents/${residentId}`);
}
