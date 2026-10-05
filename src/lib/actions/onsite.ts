"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { HOLIDAYS } from "@/lib/domain/interaction";

export type OnsiteVisitsState = { error: string | null; saved?: number; savedAt?: number };

const uuid = z.string().uuid();
const holidayValues = HOLIDAYS.map((h) => h.value) as string[];

/** One stable id per (batch, resident), so a double tap or a retry of the
 * same "Save visits" can never log anyone twice -- the same protection
 * the single log form gets from client_submission_id. */
function submissionIdFor(batchId: string, residentId: string) {
  const h = createHash("sha256").update(`${batchId}:${residentId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** On-site mode's "tick everyone you saw, then Save visits": logs one
 * resident visit per ticked resident, now, by the signed-in staff
 * member. Only residents currently at this facility (and visible to
 * them) are logged. */
export async function logOnsiteVisits(
  facilityId: string,
  _prevState: OnsiteVisitsState,
  formData: FormData
): Promise<OnsiteVisitsState> {
  const residentIds = formData
    .getAll("resident_id")
    .map(String)
    .filter((id) => uuid.safeParse(id).success);
  if (residentIds.length === 0) return { error: "Tick at least one resident you saw." };

  const batch = uuid.safeParse(formData.get("batch_id"));
  if (!batch.success) return { error: "Something went wrong. Please refresh the page and try again." };

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const holidayRaw = String(formData.get("holiday") ?? "");
  const holiday = holidayValues.includes(holidayRaw) ? holidayRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { data: residents, error: readError } = await supabase
    .from("residents")
    .select("id")
    .in("id", residentIds)
    .eq("current_facility_id", facilityId);
  if (readError || !residents?.length) return { error: "Those residents couldn't be found at this facility." };

  const occurredAt = new Date().toISOString();
  let saved = 0;
  for (const r of residents) {
    const { error } = await supabase.from("interactions").insert({
      interaction_type: "resident_visit",
      facility_id: facilityId,
      resident_id: r.id,
      staff_member_id: user.id,
      occurred_at: occurredAt,
      notes,
      holiday,
      client_submission_id: submissionIdFor(batch.data, r.id),
    });
    // 23505 = already saved by an earlier tap of the same batch.
    if (!error || error.code === "23505") saved += 1;
  }

  revalidatePath(`/facilities/${facilityId}/onsite`);
  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/residents");
  revalidatePath("/dashboard");
  for (const r of residents) revalidatePath(`/residents/${r.id}`);

  if (saved < residents.length) {
    return { error: `Saved ${saved} of ${residents.length} visits. Please check the residents that are still ticked.`, saved, savedAt: Date.now() };
  }
  return { error: null, saved, savedAt: Date.now() };
}
