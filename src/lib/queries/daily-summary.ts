import { createClient } from "@/lib/supabase/server";
import { orgDayBounds } from "@/lib/org-day";
import { summarizeDay, type DailySummary, type DayInteraction, type DayRecord } from "@/lib/domain/daily-summary";
import type { InteractionType } from "@/lib/domain/interaction";

/** More than a day would realistically hold -- if a day ever reaches it
 * (e.g. a bulk import landed on one date), the page says so instead of
 * quietly showing a partial count. */
const DAY_ROW_LIMIT = 1000;

type ResidentName = { first_name: string; last_name: string; preferred_name: string | null } | null;
const residentName = (r: ResidentName) => (r ? `${r.preferred_name ?? r.first_name} ${r.last_name}` : null);

export type DailySummaryResult = {
  summary: DailySummary;
  newResidents: DayRecord[];
  newFacilities: DayRecord[];
  residentMoves: DayRecord[];
  followUps: DayRecord[];
  truncated: boolean;
};

/**
 * Everything recorded in the CRM for one org calendar day (America/New_York
 * midnight to midnight -- see lib/org-day.ts). Read-only, and it runs as the
 * signed-in user, so row-level security limits a facility-restricted account
 * to the facilities it can already see.
 *
 * "Happened today" means: interactions whose occurred_at falls on the day,
 * and residents / facilities / follow-up tasks / facility moves whose
 * record was created on the day.
 */
export async function getDailySummary(day: string): Promise<DailySummaryResult> {
  const supabase = await createClient();
  const { start, end } = orgDayBounds(day);

  const [interactions, residents, facilities, tasks, history] = await Promise.all([
    supabase
      .from("interactions")
      .select(
        "id, occurred_at, interaction_type, resident_id, facility_id, quantity, people_reached, participants, funder_story, unmet_need, residents(first_name, last_name, preferred_name), facilities(name), profiles(full_name), interaction_volunteers(contact_id)",
        { count: "exact" }
      )
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at")
      .limit(DAY_ROW_LIMIT),
    supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .limit(DAY_ROW_LIMIT),
    supabase
      .from("facilities")
      .select("id, name")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .limit(DAY_ROW_LIMIT),
    supabase
      .from("tasks")
      .select("id, title")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .limit(DAY_ROW_LIMIT),
    supabase
      .from("resident_facility_history")
      .select("id, resident_id, created_at, facilities(name), residents(first_name, last_name, preferred_name, created_at)")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .limit(DAY_ROW_LIMIT),
  ]);

  for (const result of [interactions, residents, facilities, tasks, history]) {
    if (result.error) throw new Error(result.error.message);
  }

  const dayInteractions: DayInteraction[] = (interactions.data ?? []).map((row) => {
    const facility = row.facilities as unknown as { name: string } | null;
    const staff = row.profiles as unknown as { full_name: string } | null;
    const volunteers = row.interaction_volunteers as unknown as { contact_id: string }[] | null;
    return {
      id: row.id,
      occurred_at: row.occurred_at,
      interaction_type: row.interaction_type as InteractionType,
      resident_id: row.resident_id,
      resident_name: residentName(row.residents as unknown as ResidentName),
      facility_id: row.facility_id,
      facility_name: facility?.name ?? null,
      staff_member_name: staff?.full_name ?? null,
      quantity: row.quantity,
      people_reached: row.people_reached,
      participants: row.participants,
      funder_story: row.funder_story,
      unmet_need: row.unmet_need,
      volunteer_count: volunteers?.length ?? 0,
    };
  });

  // Every new resident gets a first history row from a trigger in the
  // same transaction, so it shares the resident's created_at exactly.
  // Only rows created later than that are real facility moves.
  const moves = (history.data ?? []).filter((row) => {
    const resident = row.residents as unknown as { created_at: string } | null;
    return resident !== null && new Date(row.created_at).getTime() !== new Date(resident.created_at).getTime();
  });

  const newResidents: DayRecord[] = (residents.data ?? []).map((r) => ({
    id: r.id,
    label: residentName(r) ?? "Resident",
    href: `/residents/${r.id}`,
  }));
  const newFacilities: DayRecord[] = (facilities.data ?? []).map((f) => ({
    id: f.id,
    label: f.name,
    href: `/facilities/${f.id}`,
  }));
  const residentMoves: DayRecord[] = moves.map((row) => {
    const facility = row.facilities as unknown as { name: string } | null;
    return {
      id: row.id,
      label: `${residentName(row.residents as unknown as ResidentName) ?? "Resident"} → ${facility?.name ?? "new facility"}`,
      href: `/residents/${row.resident_id}`,
    };
  });
  const followUps: DayRecord[] = (tasks.data ?? []).map((t) => ({ id: t.id, label: t.title, href: `/tasks/${t.id}` }));

  return {
    summary: summarizeDay({
      interactions: dayInteractions,
      tasksCreated: followUps.length,
      newResidents: newResidents.length,
      newFacilities: newFacilities.length,
      residentMoves: residentMoves.length,
    }),
    newResidents,
    newFacilities,
    residentMoves,
    followUps,
    truncated:
      (interactions.count ?? 0) > DAY_ROW_LIMIT ||
      [residents, facilities, tasks, history].some((r) => (r.data?.length ?? 0) >= DAY_ROW_LIMIT),
  };
}
