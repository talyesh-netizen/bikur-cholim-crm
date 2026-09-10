"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TransferFormState = { error: string | null };

const transferSchema = z.object({
  new_facility_id: z.string().uuid("Please choose a facility."),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * The one place in the app that moves a resident to a different
 * facility. It delegates to the database's transfer_resident()
 * function (see
 * supabase/migrations/20260910190113_resident_transfer_function.sql),
 * which updates the resident's current facility, automatically rewrites
 * their facility history, and logs the move in the interaction log — as
 * a single all-or-nothing operation. This action's job is just to
 * validate the form and call it; the actual history-preserving logic
 * lives in the database, not here, so it can never be bypassed by some
 * other code path that forgets to do it.
 */
export async function transferResident(
  residentId: string,
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const parsed = transferSchema.safeParse({
    new_facility_id: formData.get("new_facility_id"),
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_resident", {
    p_resident_id: residentId,
    p_new_facility_id: parsed.data.new_facility_id,
    p_reason: parsed.data.reason ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    return { error: "Something went wrong recording this move. Please try again." };
  }

  revalidatePath("/residents");
  revalidatePath(`/residents/${residentId}`);
  revalidatePath("/facilities");
  redirect(`/residents/${residentId}`);
}
