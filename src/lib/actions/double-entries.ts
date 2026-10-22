"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { headlineAsFirstRecorded, quarterOf } from "@/lib/queries/impact-overview";

export type ReviewResult = { ok: boolean; error?: string };

/** Before the first correction in a quarter (a "Same visit" answer or a
 * void), that quarter's totals as first recorded are saved once, so a
 * report already sent can always be matched. True when they're saved
 * (now or before). Only an admin can save them. */
export async function saveQuarterAsFirstRecorded(occurredAt: string): Promise<boolean> {
  const supabase = await createClient();
  const quarter = quarterOf(occurredAt);
  const { count } = await supabase
    .from("report_snapshots")
    .select("metric", { count: "exact", head: true })
    .eq("period_key", quarter.key);
  if (count) return true;
  const h = await headlineAsFirstRecorded(quarter.from, quarter.to);
  const values: Record<string, number> = {
    one_on_one_visits_and_calls: h.residentContacts,
    residents_served: h.residents,
    family_conversations: h.familyConversations,
    families: h.families,
    staff_engagements: h.staffTouchpoints,
    staff_people: h.staffPeople,
    programs: h.programs,
    deliveries: h.deliveries,
    reached: h.reached,
    facility_visit_days: h.visitDays,
    volunteer_only_days: h.volunteerOnlyDays,
    facility_presence_days: h.presenceDays,
    facilities_visited: h.facilitiesVisited,
    facilities_engaged: h.facilitiesEngaged,
    group_volunteers: h.groupVolunteers,
  };
  const { error } = await supabase
    .from("report_snapshots")
    .upsert(
      Object.entries(values).map(([metric, value]) => ({ period_key: quarter.key, metric, value })),
      { onConflict: "period_key,metric", ignoreDuplicates: true }
    );
  return !error;
}

/**
 * An admin's answer to one suspected double entry. "same": the other
 * entry is counted once, in the kept one, and its staff member is
 * credited there too. "separate": both stay counted. Before the first
 * "same" in a quarter, that quarter's totals as first recorded are saved
 * once, so a report already sent can always be matched.
 */
export async function reviewDoubleEntry(keptId: string, otherId: string, decision: "same" | "separate"): Promise<ReviewResult> {
  if (!z.string().uuid().safeParse(keptId).success || !z.string().uuid().safeParse(otherId).success) {
    return { ok: false, error: "Those entries could not be found." };
  }
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, error: "Only an admin can review double entries." };

  const supabase = await createClient();

  if (decision === "same") {
    const { data: other } = await supabase.from("interactions").select("occurred_at").eq("id", otherId).maybeSingle();
    if (!other) return { ok: false, error: "That entry could not be found." };
    if (!(await saveQuarterAsFirstRecorded(other.occurred_at as string))) {
      return { ok: false, error: "Not saved: the quarter's original totals couldn't be recorded first." };
    }
  }

  const { error } = await supabase.rpc("review_double_entry", {
    p_kept_id: keptId,
    p_other_id: otherId,
    p_decision: decision,
  });
  if (error) return { ok: false, error: error.message.includes("already") ? "One of these was already reviewed." : "Not saved. Please try again." };

  // No revalidatePath here: it would re-render this list and drop the
  // answered row before its "Saved" shows. Data Quality and Impact are
  // built fresh on every visit, so they show the change next time.
  return { ok: true };
}

/** Takes back one answer (e.g. tapped by mistake). */
export async function undoDoubleEntryReview(reviewId: string): Promise<ReviewResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, error: "Only an admin can review double entries." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_double_entry_review", { p_review_id: reviewId });
  if (error) return { ok: false, error: "Not undone. Please try again." };
  revalidatePath("/data-quality/double-entries");
  revalidatePath("/impact");
  return { ok: true };
}
