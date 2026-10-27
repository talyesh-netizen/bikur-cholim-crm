"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { withSaved } from "@/lib/saved-flash";

export type StoryFormState = {
  error: string | null;
  /** What was typed and picked, so a failed save never loses it. */
  values?: { story: string; resident_id: string; facility_id: string };
};

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const storySchema = z.object({
  story: z.string().trim().min(1, "Please write the story."),
  resident_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  facility_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

/** Saves a new story (id null) or changes one: the text and, if wanted, a
 * resident and/or a facility. Nothing else is asked (Oct 27, 2026). */
export async function saveStory(
  id: string | null,
  redirectTo: string,
  _prev: StoryFormState,
  formData: FormData
): Promise<StoryFormState> {
  const values = {
    story: String(formData.get("story") ?? ""),
    resident_id: String(formData.get("resident_id") ?? ""),
    facility_id: String(formData.get("facility_id") ?? ""),
  };
  const parsed = storySchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the story.", values };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again.", values };

  const row = {
    story: parsed.data.story,
    resident_id: parsed.data.resident_id ?? null,
    facility_id: parsed.data.facility_id ?? null,
  };
  const { data, error } = id
    ? await supabase.from("stories").update(row).eq("id", id).select("id")
    : await supabase.from("stories").insert({ ...row, created_by: user.id }).select("id");
  // A save the access rules don't allow comes back as "0 rows" -- never
  // treat that as saved.
  if (error || !data || data.length === 0) {
    return {
      error:
        !error || error.code === "42501"
          ? "This story was NOT saved: you don't have access to that resident or facility."
          : "This story was NOT saved -- something went wrong. Your story is still below; please try again.",
      values,
    };
  }

  revalidatePath("/stories");
  if (row.resident_id) revalidatePath(`/residents/${row.resident_id}`);
  if (row.facility_id) revalidatePath(`/facilities/${row.facility_id}`);
  redirect(withSaved(redirectTo, "story-saved"));
}
