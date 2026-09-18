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
  contact_id: string | null;
  staff_member_id: string;
  notes: string | null;
  created_at: string;
  residents: { first_name: string; last_name: string; preferred_name: string | null } | null;
  facilities: { name: string } | null;
  contacts: { name: string } | null;
  profiles: { full_name: string } | null;
}): InteractionWithNames {
  const resident = row.residents;
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    interaction_type: row.interaction_type as InteractionWithNames["interaction_type"],
    facility_id: row.facility_id,
    resident_id: row.resident_id,
    contact_id: row.contact_id,
    staff_member_id: row.staff_member_id,
    notes: row.notes,
    created_at: row.created_at,
    resident_name: resident
      ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}`
      : null,
    facility_name: row.facilities?.name ?? null,
    contact_name: row.contacts?.name ?? null,
    staff_member_name: row.profiles?.full_name ?? null,
  };
}

const SELECT_WITH_NAMES =
  "id, occurred_at, interaction_type, facility_id, resident_id, contact_id, staff_member_id, notes, created_at, residents(first_name, last_name, preferred_name), facilities(name), contacts(name), profiles(full_name)";

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

export async function getInteraction(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select(SELECT_WITH_NAMES)
    .eq("id", id)
    .single();

  if (error) return null;
  return toInteractionWithNames(data as unknown as Parameters<typeof toInteractionWithNames>[0]);
}

export async function listRecentInteractions(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select(SELECT_WITH_NAMES)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toInteractionWithNames(row as unknown as Parameters<typeof toInteractionWithNames>[0]));
}

const INTERACTION_LIST_PAGE_SIZE = 100;

export type InteractionListFilters = {
  interactionType?: string;
  facilityId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

export async function listInteractions(filters: InteractionListFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("interactions")
    .select(SELECT_WITH_NAMES, { count: "exact" })
    .order("occurred_at", { ascending: false })
    .limit(INTERACTION_LIST_PAGE_SIZE);

  if (filters.interactionType) {
    query = query.eq("interaction_type", filters.interactionType);
  }
  if (filters.facilityId) {
    query = query.eq("facility_id", filters.facilityId);
  }
  if (filters.dateFrom) {
    query = query.gte("occurred_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("occurred_at", filters.dateTo);
  }
  if (filters.search) {
    query = query.ilike("notes", `%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    interactions: (data ?? []).map((row) =>
      toInteractionWithNames(row as unknown as Parameters<typeof toInteractionWithNames>[0])
    ),
    totalCount: count ?? 0,
    pageSize: INTERACTION_LIST_PAGE_SIZE,
  };
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
