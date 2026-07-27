"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  FACILITY_TYPES,
  ENGAGEMENT_STATUSES,
  VISIT_PRIORITIES,
  KOSHER_FOOD_OPTIONS,
} from "@/lib/domain/facility";

const facilityTypeValues = FACILITY_TYPES.map((o) => o.value) as [string, ...string[]];
const engagementStatusValues = ENGAGEMENT_STATUSES.map((o) => o.value) as [string, ...string[]];
const visitPriorityValues = VISIT_PRIORITIES.map((o) => o.value) as [string, ...string[]];
const kosherFoodValues = KOSHER_FOOD_OPTIONS.map((o) => o.value) as [string, ...string[]];

// Turns "" (an empty form field) into undefined/null rather than
// letting an empty string slip into an optional database column.
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

const facilitySchema = z.object({
  name: z.string().trim().min(1, "Facility name is required."),
  facility_type: z.enum(facilityTypeValues, { message: "Please choose a facility type." }),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  zip: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  main_phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  website: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  parent_healthcare_group: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  geographic_cluster_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  approx_jewish_resident_count: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0, "Must be zero or more.").optional()
  ),
  jewish_residents_currently_known: z.coerce.boolean().default(false),
  engagement_status: z.enum(engagementStatusValues),
  visit_priority: z.enum(visitPriorityValues),
  recommended_visit_frequency: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  kosher_food_availability: z.preprocess(emptyToUndefined, z.enum(kosherFoodValues).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type FacilityFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back whatever the person typed so the form can be
  // re-populated if saving fails — otherwise a network hiccup or a
  // validation mistake on one field would silently wipe out everything
  // else they'd already filled in, which is exactly the kind of thing
  // that erodes trust in the app for a non-technical user.
  values?: Record<string, string>;
};

function parseFacilityForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  // Checkboxes only appear in FormData when checked, so a missing key
  // means "false" here.
  raw.jewish_residents_currently_known = formData.has("jewish_residents_currently_known")
    ? "true"
    : "false";
  return { raw, result: facilitySchema.safeParse(raw) };
}

export async function createFacility(
  _prevState: FacilityFormState,
  formData: FormData
): Promise<FacilityFormState> {
  const { raw, result: parsed } = parseFacilityForm(formData);
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
    .from("facilities")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    return {
      error: "Something went wrong saving this facility. Please try again.",
      values: raw,
    };
  }

  revalidatePath("/facilities");
  redirect(`/facilities/${data.id}`);
}

export async function updateFacility(
  facilityId: string,
  _prevState: FacilityFormState,
  formData: FormData
): Promise<FacilityFormState> {
  const { raw, result: parsed } = parseFacilityForm(formData);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: flattenErrors(parsed.error),
      values: raw,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("facilities")
    .update(parsed.data)
    .eq("id", facilityId);

  if (error) {
    return {
      error: "Something went wrong saving this facility. Please try again.",
      values: raw,
    };
  }

  revalidatePath("/facilities");
  revalidatePath(`/facilities/${facilityId}`);
  redirect(`/facilities/${facilityId}`);
}

export async function setFacilityActive(facilityId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("facilities").update({ active }).eq("id", facilityId);
  if (error) {
    throw new Error("Could not update this facility's active status.");
  }
  revalidatePath("/facilities");
  revalidatePath(`/facilities/${facilityId}`);
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
