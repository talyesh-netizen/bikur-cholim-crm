"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MODEL = "claude-opus-5";
const MAX_NOTE_LENGTH = 1500;

export type SaveProfileNoteResult =
  | { ok: true; cleanNote: string }
  | { ok: false; error: string };

function conservativeCleanup(note: string): string {
  const collapsed = note.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";
  const capped = collapsed.length > 280 ? `${collapsed.slice(0, 277).trimEnd()}…` : collapsed;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

async function cleanProfileNote(rawNote: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return conservativeCleanup(rawNote);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 180,
      messages: [
        {
          role: "user",
          content:
            "Clean this internal CRM observation into one or two short, natural sentences. " +
            "Keep only facts explicitly stated. Do not diagnose, infer, embellish, add advice, or change names/numbers. " +
            "Use plain concise wording. Return only the cleaned note.\n\n" +
            rawNote,
        },
      ],
    });

    const text = response.content.find((part) => part.type === "text");
    const cleaned = text && text.type === "text" ? text.text.trim() : "";
    return cleaned || conservativeCleanup(rawNote);
  } catch (error) {
    console.error("Profile note cleanup failed", error instanceof Anthropic.APIError ? error.status : "");
    return conservativeCleanup(rawNote);
  }
}

export async function saveProfileNote(
  targetType: "resident" | "facility",
  targetId: string,
  rawNote: string
): Promise<SaveProfileNoteResult> {
  const trimmed = rawNote.trim();
  if (!trimmed) return { ok: false, error: "Type or dictate a note first." };
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: "Keep this quick note under 1,500 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  let facilityId: string | null = null;

  if (targetType === "resident") {
    const { data: resident, error } = await supabase
      .from("residents")
      .select("id, current_facility_id")
      .eq("id", targetId)
      .single();
    if (error || !resident) return { ok: false, error: "Resident not found or you no longer have access." };
    facilityId = resident.current_facility_id;
  } else {
    const { data: facility, error } = await supabase
      .from("facilities")
      .select("id")
      .eq("id", targetId)
      .single();
    if (error || !facility) return { ok: false, error: "Facility not found or you no longer have access." };
    facilityId = targetId;
  }

  const cleanNote = await cleanProfileNote(trimmed);

  const insert =
    targetType === "resident"
      ? { resident_id: targetId, facility_id: null, raw_note: trimmed, clean_note: cleanNote, created_by: user.id }
      : { resident_id: null, facility_id: targetId, raw_note: trimmed, clean_note: cleanNote, created_by: user.id };

  const { error } = await supabase.from("profile_notes").insert(insert);
  if (error) {
    console.error("Profile note save failed", error.message);
    return { ok: false, error: "The note was not saved. Please try again." };
  }

  if (targetType === "resident") revalidatePath(`/residents/${targetId}`);
  if (facilityId) {
    revalidatePath(`/facilities/${facilityId}`);
    revalidatePath(`/facilities/${facilityId}/onsite`);
  }

  return { ok: true, cleanNote };
}
