import { createClient } from "@/lib/supabase/server";
import { INTERACTION_TYPES, type Interaction } from "@/lib/domain/interaction";

export type DataQualityRow = { id: string; label: string; href: string; missing: string };

export type DataQualityReport = {
  contactsMissingPhone: DataQualityRow[];
  contactsMissingEmail: DataQualityRow[];
  facilitiesMissingPhone: DataQualityRow[];
  facilitiesMissingAddress: DataQualityRow[];
  organizationsMissingPhone: DataQualityRow[];
};

/** Everything with a gap in its basic contact info -- active records
 * only, since an inactive/retired record's missing phone number isn't
 * anyone's problem to chase down. Each section links straight to the
 * record's edit page. */
export async function getDataQualityReport(): Promise<DataQualityReport> {
  const supabase = await createClient();

  const [contactsPhone, contactsEmail, facilitiesPhone, facilitiesAddress, organizationsPhone] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name")
      .eq("active", true)
      .or("phone.is.null,phone.eq.")
      .order("name"),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("active", true)
      .or("email.is.null,email.eq.")
      .order("name"),
    supabase
      .from("facilities")
      .select("id, name")
      .eq("active", true)
      .or("main_phone.is.null,main_phone.eq.")
      .order("name"),
    supabase
      .from("facilities")
      .select("id, name")
      .eq("active", true)
      .or("address.is.null,address.eq.")
      .order("name"),
    supabase
      .from("organizations")
      .select("id, name")
      .eq("active", true)
      .or("main_phone.is.null,main_phone.eq.")
      .order("name"),
  ]);

  return {
    contactsMissingPhone: (contactsPhone.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      href: `/contacts/${c.id}/edit`,
      missing: "phone",
    })),
    contactsMissingEmail: (contactsEmail.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      href: `/contacts/${c.id}/edit`,
      missing: "email",
    })),
    facilitiesMissingPhone: (facilitiesPhone.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      href: `/facilities/${f.id}/edit`,
      missing: "main phone",
    })),
    facilitiesMissingAddress: (facilitiesAddress.data ?? []).map((f) => ({
      id: f.id,
      label: f.name,
      href: `/facilities/${f.id}/edit`,
      missing: "address",
    })),
    organizationsMissingPhone: (organizationsPhone.data ?? []).map((o) => ({
      id: o.id,
      label: o.name,
      href: `/organizations/${o.id}/edit`,
      missing: "main phone",
    })),
  };
}

/** interaction_ids from every currently-tagged volunteer visit -- shared
 * by the count and the full list below so they can never disagree. */
async function getUntaggedVolunteerVisitIds(): Promise<string[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("interaction_volunteers").select("interaction_id");
  if (error) throw new Error(error.message);
  const taggedIds = Array.from(new Set((data ?? []).map((r) => r.interaction_id as string)));
  return taggedIds.length > 0 ? taggedIds : null;
}

/** How many logged "Volunteer visit" interactions still have nobody
 * checked off in "Volunteers involved" -- shown as a count on the Data
 * Quality page, linking to the full list below. */
export async function getVolunteerVisitGapCount(): Promise<number> {
  const supabase = await createClient();
  const taggedIds = await getUntaggedVolunteerVisitIds();

  let query = supabase
    .from("interactions")
    .select("id", { count: "exact", head: true })
    .eq("interaction_type", "volunteer_visit");
  if (taggedIds) query = query.not("id", "in", `(${taggedIds.join(",")})`);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type VolunteerVisitGap = {
  id: string;
  occurred_at: string;
  facility_name: string | null;
  resident_name: string | null;
  href: string;
};

/** The full list behind getVolunteerVisitGapCount, most recent first --
 * each one links straight to that interaction's edit page, where the
 * "Volunteers involved" checklist is now front and center. */
export async function getVolunteerVisitGaps(): Promise<VolunteerVisitGap[]> {
  const supabase = await createClient();
  const taggedIds = await getUntaggedVolunteerVisitIds();

  let query = supabase
    .from("interactions")
    .select("id, occurred_at, facilities(name), residents(first_name, last_name, preferred_name)")
    .eq("interaction_type", "volunteer_visit")
    .order("occurred_at", { ascending: false });
  if (taggedIds) query = query.not("id", "in", `(${taggedIds.join(",")})`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const facility = row.facilities as unknown as { name: string } | null;
    const resident = row.residents as unknown as
      | { first_name: string; last_name: string; preferred_name: string | null }
      | null;
    return {
      id: row.id,
      occurred_at: row.occurred_at,
      facility_name: facility?.name ?? null,
      resident_name: resident ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}` : null,
      href: `/interactions/${row.id}/edit`,
    };
  });
}

/** How many older entries per activity type still haven't been looked at
 * on the "Review past entries" screen (service_reviewed_at is null) --
 * the migration that added the new service types left every existing
 * row unreviewed, and anything logged or edited since is stamped. */
export async function getUnreviewedCountsByType(): Promise<{ type: string; count: number }[]> {
  const supabase = await createClient();
  const results = await Promise.all(
    INTERACTION_TYPES.map(async (t) => {
      const { count, error } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("interaction_type", t.value)
        .is("service_reviewed_at", null);
      if (error) throw new Error(error.message);
      return { type: t.value as string, count: count ?? 0 };
    })
  );
  return results.filter((r) => r.count > 0);
}

export type UnreviewedEntry = Pick<
  Interaction,
  "id" | "occurred_at" | "interaction_type" | "notes" | "occasion" | "program_partner" | "quantity" | "people_reached" | "participants"
> & {
  facility_name: string | null;
  resident_name: string | null;
  staff_member_name: string | null;
};

export const REVIEW_PAGE_SIZE = 50;

/** One screenful of not-yet-reviewed entries, most recent first. */
export async function listUnreviewedEntries(interactionType?: string): Promise<UnreviewedEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("interactions")
    .select(
      "id, occurred_at, interaction_type, notes, occasion, program_partner, quantity, people_reached, participants, facilities(name), residents(first_name, last_name, preferred_name), profiles(full_name)"
    )
    .is("service_reviewed_at", null)
    .order("occurred_at", { ascending: false })
    .limit(REVIEW_PAGE_SIZE);
  if (interactionType) query = query.eq("interaction_type", interactionType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const facility = row.facilities as unknown as { name: string } | null;
    const resident = row.residents as unknown as
      | { first_name: string; last_name: string; preferred_name: string | null }
      | null;
    const staff = row.profiles as unknown as { full_name: string } | null;
    return {
      id: row.id,
      occurred_at: row.occurred_at,
      interaction_type: row.interaction_type,
      notes: row.notes,
      occasion: row.occasion,
      program_partner: row.program_partner,
      quantity: row.quantity,
      people_reached: row.people_reached,
      participants: row.participants,
      facility_name: facility?.name ?? null,
      resident_name: resident ? `${resident.preferred_name ?? resident.first_name} ${resident.last_name}` : null,
      staff_member_name: staff?.full_name ?? null,
    };
  });
}
