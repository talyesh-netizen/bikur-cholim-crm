import { createClient } from "@/lib/supabase/server";

export type ProfileNote = {
  id: string;
  raw_note: string;
  clean_note: string;
  created_at: string;
  created_by_name: string | null;
};

function mapNote(row: {
  id: string;
  raw_note: string;
  clean_note: string;
  created_at: string;
  profiles: { full_name: string } | null;
}): ProfileNote {
  return {
    id: row.id,
    raw_note: row.raw_note,
    clean_note: row.clean_note,
    created_at: row.created_at,
    created_by_name: row.profiles?.full_name ?? null,
  };
}

const SELECT = "id, raw_note, clean_note, created_at, profiles!profile_notes_created_by_fkey(full_name)";

export async function listResidentProfileNotes(residentId: string, limit = 25): Promise<ProfileNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_notes")
    .select(SELECT)
    .eq("resident_id", residentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapNote(row as unknown as Parameters<typeof mapNote>[0]));
}

export async function listFacilityProfileNotes(facilityId: string, limit = 25): Promise<ProfileNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_notes")
    .select(SELECT)
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapNote(row as unknown as Parameters<typeof mapNote>[0]));
}
