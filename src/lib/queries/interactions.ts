import { createClient } from "@/lib/supabase/server";
import type { InteractionWithNames, ServiceDetails } from "@/lib/domain/interaction";
import { escapeIlikeTerm } from "@/lib/supabase-filters";
import { orgDayStartIso, nextDay } from "@/lib/format-date";
import { residentName } from "@/lib/domain/resident-name";

// Recent-interactions lists on resident/facility pages show a short,
// scannable history rather than the full log — see the interactions
// table comment in the migration for why one table backs both lists.
const RECENT_INTERACTIONS_LIMIT = 10;

function toInteractionWithNames(row: ServiceDetails & {
  id: string;
  occurred_at: string;
  interaction_type: string;
  facility_id: string | null;
  resident_id: string | null;
  contact_id: string | null;
  staff_member_id: string;
  notes: string | null;
  created_at: string;
  residents: { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;
  facilities: { name: string; geographic_cluster_id: string | null } | null;
  contacts: { name: string } | null;
  profiles: { full_name: string } | null;
  interaction_volunteers: { contacts: { id: string; name: string } | null }[] | null;
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
    occasion: row.occasion,
    holiday: row.holiday ?? null,
    family_need: row.family_need ?? null,
    program_partner: row.program_partner,
    quantity: row.quantity,
    people_reached: row.people_reached,
    participants: row.participants,
    minutes_spent: row.minutes_spent,
    unmet_need: row.unmet_need,
    unmet_need_reason: row.unmet_need_reason,
    funder_story: row.funder_story,
    resident_name: resident
      ? residentName(resident)
      : null,
    facility_name: row.facilities?.name ?? null,
    facility_cluster_id: row.facilities?.geographic_cluster_id ?? null,
    contact_name: row.contacts?.name ?? null,
    staff_member_name: row.profiles?.full_name ?? null,
    volunteers: (row.interaction_volunteers ?? [])
      .map((iv) => iv.contacts)
      .filter((c): c is { id: string; name: string } => c !== null),
  };
}

// contacts!interactions_contact_id_fkey disambiguates: interaction_volunteers
// also links interactions to contacts (many-to-many), so PostgREST can't
// infer which relationship "contacts(...)" means without the hint — it
// returns an HTTP 300 "multiple relationships found" error otherwise.
// interaction_volunteers(contacts(...)) is a separate, unambiguous path
// (through the join table) that pulls in who's actually tagged as
// having been on a volunteer_visit -- see the type comment on
// InteractionWithNames for why this must stay distinct from contact_id.
const SELECT_WITH_NAMES =
  "id, occurred_at, interaction_type, facility_id, resident_id, contact_id, staff_member_id, notes, created_at, occasion, holiday, family_need, program_partner, quantity, people_reached, participants, minutes_spent, unmet_need, unmet_need_reason, funder_story, residents(first_name, last_name, preferred_name), facilities(name, geographic_cluster_id), contacts!interactions_contact_id_fkey(name), profiles(full_name), interaction_volunteers(contacts(id, name))";

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
  staffId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  flag?: "funder_story" | "unmet_need";
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
  if (filters.staffId) {
    query = query.eq("staff_member_id", filters.staffId);
  }
  // The date filters are plain Cleveland calendar days ("2026-09-22")
  // from a date input, but occurred_at is an exact moment -- so "from the
  // 22nd" means from midnight Cleveland time, and "to the 22nd" means
  // before midnight Cleveland time at the start of the 23rd (the whole
  // day included), not midnight UTC (which would drop evening visits).
  const dateFrom = filters.dateFrom ? orgDayStartIso(filters.dateFrom) : null;
  if (dateFrom) {
    query = query.gte("occurred_at", dateFrom);
  }
  const dateToExclusive = filters.dateTo ? orgDayStartIso(nextDay(filters.dateTo)) : null;
  if (dateToExclusive) {
    query = query.lt("occurred_at", dateToExclusive);
  }
  if (filters.flag) {
    query = query.eq(filters.flag, true);
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
      // For a volunteer visit, who took part is recorded ONLY in
      // interaction_volunteers (the second query) -- contact_id on a
      // volunteer_visit must never put it on someone's history.
      .neq("interaction_type", "volunteer_visit")
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

export type VisitPartner = { id: string; name: string; visitCount: number; lastVisitAt: string };

type VisitPairRow = {
  contact_id: string;
  contacts: { id: string; name: string } | null;
  interactions: {
    occurred_at: string;
    resident_id: string | null;
    residents: { first_name: string | null; last_name: string | null; preferred_name: string | null } | null;
  } | null;
};

function summarizePartners(
  rows: VisitPairRow[],
  partnerOf: (row: VisitPairRow) => { id: string; name: string } | null
): VisitPartner[] {
  const byId = new Map<string, VisitPartner>();
  for (const row of rows) {
    const partner = partnerOf(row);
    const occurredAt = row.interactions?.occurred_at;
    if (!partner || !occurredAt) continue;
    const existing = byId.get(partner.id);
    if (existing) {
      existing.visitCount += 1;
      if (occurredAt > existing.lastVisitAt) existing.lastVisitAt = occurredAt;
    } else {
      byId.set(partner.id, { ...partner, visitCount: 1, lastVisitAt: occurredAt });
    }
  }
  return [...byId.values()].sort((a, b) => b.lastVisitAt.localeCompare(a.lastVisitAt));
}

const VISIT_PAIR_SELECT =
  "contact_id, contacts(id, name), interactions!inner(occurred_at, resident_id, interaction_type, residents(first_name, last_name, preferred_name))";

/** Every volunteer who has visited this resident, with how many visits
 * and when the last one was -- across all history, not just the recent
 * interactions shown on the page. */
export async function listVolunteersForResident(residentId: string): Promise<VisitPartner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interaction_volunteers")
    .select(VISIT_PAIR_SELECT)
    .eq("interactions.interaction_type", "volunteer_visit")
    .eq("interactions.resident_id", residentId);

  if (error) throw new Error(error.message);
  return summarizePartners((data ?? []) as unknown as VisitPairRow[], (row) => row.contacts);
}

/** Every resident this volunteer has visited (one-on-one visits; group
 * visits with no single resident aren't included), with counts. */
export async function listResidentsVisitedByVolunteer(contactId: string): Promise<VisitPartner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interaction_volunteers")
    .select(VISIT_PAIR_SELECT)
    .eq("contact_id", contactId)
    .eq("interactions.interaction_type", "volunteer_visit")
    .not("interactions.resident_id", "is", null);

  if (error) throw new Error(error.message);
  return summarizePartners((data ?? []) as unknown as VisitPairRow[], (row) => {
    const i = row.interactions;
    if (!i?.resident_id || !i.residents) return null;
    const r = i.residents;
    return { id: i.resident_id, name: residentName(r).trim() };
  });
}
