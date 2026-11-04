import type { createClient } from "@/lib/supabase/server";

/**
 * "Save note to: This visit / Resident profile" (director, Nov 4, 2026),
 * shared by the log form and On-site Mode. A note sent to the profile is
 * saved once on each resident's "About them" notes (the existing
 * profile_notes, with its author and date, kept exactly as typed), and the
 * visit itself is saved without it: one place or the other, never both.
 */

export type NoteTarget = "visit" | "profile";

/** The longest note a resident's profile takes (as in profile-notes.ts). */
export const PROFILE_NOTE_MAX = 1500;

export const PROFILE_NOTE_TOO_LONG =
  "A note for the resident's profile can be up to 1,500 characters. Shorten it, or save it with this visit.";

/** Saves the note on each resident's profile. If that fails, the note is
 * put on the visit(s) instead, so it's never lost and never in both
 * places. True when it went to the profile. */
export async function saveNoteToProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    residentIds,
    note,
    authorId,
    interactionIds,
  }: { residentIds: string[]; note: string; authorId: string; interactionIds: string[] }
): Promise<boolean> {
  const residents = [...new Set(residentIds)];
  const { error } = residents.length
    ? await supabase
        .from("profile_notes")
        .insert(residents.map((residentId) => ({ resident_id: residentId, facility_id: null, raw_note: note, clean_note: note, created_by: authorId })))
    : { error: { message: "no resident" } };
  if (!error) return true;
  console.error("Visit note to profile failed; kept on the visit instead", error.message);
  await supabase.from("interactions").update({ notes: note }).in("id", interactionIds);
  return false;
}
