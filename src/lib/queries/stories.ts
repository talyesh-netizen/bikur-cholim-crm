import { createClient } from "@/lib/supabase/server";
import { residentName } from "@/lib/domain/resident-name";

/** A story with the names it's linked to (see the stories migration). */
export type Story = {
  id: string;
  story: string;
  resident_id: string | null;
  facility_id: string | null;
  created_at: string;
  updated_at: string;
  resident_name: string | null;
  facility_name: string | null;
  written_by: string | null;
};

const SELECT =
  "id, story, resident_id, facility_id, created_at, updated_at, residents(first_name, last_name, preferred_name), facilities(name), profiles!stories_created_by_fkey(full_name)";

type Row = {
  id: string;
  story: string;
  resident_id: string | null;
  facility_id: string | null;
  created_at: string;
  updated_at: string;
  residents: { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;
  facilities: { name: string } | null;
  profiles: { full_name: string } | null;
};

const toStory = (r: Row): Story => ({
  id: r.id,
  story: r.story,
  resident_id: r.resident_id,
  facility_id: r.facility_id,
  created_at: r.created_at,
  updated_at: r.updated_at,
  resident_name: r.residents ? residentName(r.residents) : null,
  facility_name: r.facilities?.name ?? null,
  written_by: r.profiles?.full_name ?? null,
});

/** Stories, newest first: everyone's, or one resident's or facility's.
 * Only the ones this person is allowed to see come back. */
export async function listStories(filter: { residentId?: string; facilityId?: string } = {}, limit = 200): Promise<Story[]> {
  const supabase = await createClient();
  let query = supabase.from("stories").select(SELECT).order("created_at", { ascending: false }).limit(limit);
  if (filter.residentId) query = query.eq("resident_id", filter.residentId);
  if (filter.facilityId) query = query.eq("facility_id", filter.facilityId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toStory);
}

export async function getStory(id: string): Promise<Story | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toStory(data as unknown as Row) : null;
}
