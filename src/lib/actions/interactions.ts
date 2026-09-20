"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INTERACTION_TYPES } from "@/lib/domain/interaction";

const typeValues = INTERACTION_TYPES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export type InteractionFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back what was typed so a failed save never silently discards
  // it — same pattern as lib/actions/facilities.ts and residents.ts.
  values?: Record<string, string>;
};

const interactionSchema = z.object({
  resident_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  contact_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  facility_id: z.string().uuid("Please choose a facility."),
  occurred_at: z.string().min(1, "Please enter a date and time."),
  interaction_type: z.enum(typeValues),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

/** Replaces the set of volunteers linked to an interaction. Delete-then
 * -insert is simplest and safe here: interaction_volunteers has no
 * fields of its own worth preserving across an edit. */
async function saveInteractionVolunteers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interactionId: string,
  volunteerIds: string[]
) {
  const { error: deleteError } = await supabase
    .from("interaction_volunteers")
    .delete()
    .eq("interaction_id", interactionId);
  if (deleteError) return deleteError;

  if (volunteerIds.length === 0) return null;

  const { error: insertError } = await supabase
    .from("interaction_volunteers")
    .insert(volunteerIds.map((contact_id) => ({ interaction_id: interactionId, contact_id })));
  return insertError;
}

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
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again.", values: raw };
  }

  const { occurred_at, ...rest } = parsed.data;
  const { data: created, error } = await supabase
    .from("interactions")
    .insert({
      ...rest,
      occurred_at: new Date(occurred_at).toISOString(),
      staff_member_id: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Something went wrong saving this interaction. Please try again.", values: raw };
  }

  if (volunteerIds.length > 0) {
    const volunteerError = await saveInteractionVolunteers(supabase, created.id, volunteerIds);
    if (volunteerError) {
      return {
        error: "The interaction was saved, but the volunteers involved couldn't be recorded. Edit it to try again.",
        values: raw,
      };
    }
  }

  if (parsed.data.resident_id) revalidatePath(`/residents/${parsed.data.resident_id}`);
  revalidatePath(`/facilities/${parsed.data.facility_id}`);
  redirect(redirectTo);
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
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session expired. Please sign in again.", values: raw };
  }

  const { occurred_at, ...rest } = parsed.data;
  const { error } = await supabase
    .from("interactions")
    .update({
      ...rest,
      resident_id: rest.resident_id ?? null,
      contact_id: rest.contact_id ?? null,
      occurred_at: new Date(occurred_at).toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { error: "Something went wrong saving this interaction. Please try again.", values: raw };
  }

  const volunteerError = await saveInteractionVolunteers(supabase, id, volunteerIds);
  if (volunteerError) {
    return {
      error: "The interaction was saved, but the volunteers involved couldn't be updated. Please try again.",
      values: raw,
    };
  }

  if (parsed.data.resident_id) revalidatePath(`/residents/${parsed.data.resident_id}`);
  revalidatePath(`/facilities/${parsed.data.facility_id}`);
  revalidatePath("/interactions");
  redirect(redirectTo);
}
