import { createClient } from "@/lib/supabase/server";
import type { InteractionWithNames } from "@/lib/domain/interaction";
import { escapeIlikeTerm } from "@/lib/supabase-filters";

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

// contacts!interactions_contact_id_fkey disambiguates: interaction_volunteers
// also links interactions to contacts (many-to-many), so PostgREST can't
// infer which relationship "contacts(...)" means without the hint — it
// returns an HTTP 300 "multiple relationships found" error otherwise.
const SELECT_WITH_NAMES =
  "id, occurred_at, interaction_type, facility_id, resident_id, contact_id, staff_member_id, notes, created_at, residents(first_name, last_name, preferred_name), facilities(name), contacts!interactions_contact_id_fkey(name), profiles(full_name)";

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
    // filters.dateTo is a plain date ("2026-09-22") from a date input,
    // but occurred_at is a full timestamp -- comparing with .lte()
    // directly would cast the date to midnight and exclude every
    // interaction logged later that same day. Comparing "before the
    // next calendar day" instead includes the whole day.
    const [year, month, day] = filters.dateTo.split("-").map(Number);
    const exclusiveEnd = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    query = query.lt("occurred_at", exclusiveEnd);
  }
  if (filters.search) {
    query = query.ilike("notes", `%${escapeIlikeTerm(filters.search)}%`);
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

/** Every interaction a contact shows up on -- either as the direct
 * contact_id (e.g., a facility-staff communication) or as one of the
 * volunteers involved (interaction_volunteers). Used on a contact's own
 * page so a volunteer's or staff member's history is visible there,
 * not just on the resident/facility side. */
export async function listInteractionsForContact(contactId: string) {
  const supabase = await createClient();

  const [direct, viaVolunteers] = await Promise.all([
    supabase
      .from("interactions")
      .select(SELECT_WITH_NAMES)
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false })
      .limit(RECENT_INTERACTIONS_LIMIT),
    supabase
      .from("interaction_volunteers")
      .select(`interactions!inner(${SELECT_WITH_NAMES})`)
      .eq("contact_id", contactId)
      .order("occurred_at", { referencedTable: "interactions", ascending: false })
      .limit(RECENT_INTERACTIONS_LIMIT),
  ]);

  if (direct.error) throw new Error(direct.error.message);
  if (viaVolunteers.error) throw new Error(viaVolunteers.error.message);

  const byId = new Map<string, InteractionWithNames>();
  for (const row of direct.data ?? []) {
    const interaction = toInteractionWithNames(row as unknown as Parameters<typeof toInteractionWithNames>[0]);
    byId.set(interaction.id, interaction);
  }
  for (const row of viaVolunteers.data ?? []) {
    const raw = (row as unknown as { interactions: Parameters<typeof toInteractionWithNames>[0] }).interactions;
    const interaction = toInteractionWithNames(raw);
    byId.set(interaction.id, interaction);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, RECENT_INTERACTIONS_LIMIT);
}

/** The volunteer contact_ids currently linked to an interaction, for
 * pre-filling the edit form's checklist. */
export async function getInteractionVolunteerIds(interactionId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interaction_volunteers")
    .select("contact_id")
    .eq("interaction_id", interactionId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.contact_id as string);
}
