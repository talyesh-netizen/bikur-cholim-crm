import { createClient } from "@/lib/supabase/server";
import type { InteractionWithNames } from "@/lib/domain/interaction";

// Recent-interactions lists on resident/facility pages show a short,
// scannable history rather than the full log — see the interactions
// table comment in the migration for why one table backs both lists.
const RECENT_INTERACTIONS_LIMIT = 10;

function toInteractionWithNames(row: {
  id: string;
  occurred_at: string;
  interaction_type: string;
  facility_id: string | null;
  resident_id: string | null;
  staff_member_id: string;
  notes: string | null;
  created_at: string;
  residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
  facilities: { name: string } | null;
  profiles: { full_name: string } | null;
}): InteractionWithNames {
  const resident = row.residents;
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    interaction_type: row.interaction_type as InteractionWithNames["interaction_type"],
    facility_id: row.facility_id,
    resident_id: row.resident_id,
    staff_member_id: row.staff_member_id,
    notes: row.notes,
    created_at: row.created_at,
    resident_name: resident
      ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}`
      : null,
    facility_name: row.facilities?.name ?? null,
    staff_member_name: row.profiles?.full_name ?? null,
  };
}

const SELECT_WITH_NAMES =
  "id, occurred_at, interaction_type, facility_id, resident_id, staff_member_id, notes, created_at, residents(first_name, last_name, preferred_name), facilities(name), profiles(full_name)";

export async function listInteractionsForResident(residentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select(SELECT_WITH_NAMES)
    .eq("resident_id", residentId)
    .order("occurred_at", { ascending: false })
    .limit(RECENT_INTERACTIONS_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toInteractionWithNames(row as unknown as Parameters<typeof toInteractionWithNames>[0]));
}

export async function listInteractionsForFacility(facilityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select(SELECT_WITH_NAMES)
    .eq("facility_id", facilityId)
    .order("occurred_at", { ascending: false })
    .limit(RECENT_INTERACTIONS_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toInteractionWithNames(row as unknown as Parameters<typeof toInteractionWithNames>[0]));
}
