"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchWords, everyWordInAny } from "@/lib/supabase-filters";
import { residentName } from "@/lib/domain/resident-name";
import { capitalizeWords } from "@/lib/format-text";
import { CONTACT_TYPES, OFFERED_RELATIONSHIPS, labelFor } from "@/lib/domain/contact";
import { formatTimeOfDay } from "@/lib/format-date";

/**
 * On-site mode's one visit workflow (director, Oct 9, 2026): find
 * someone, visit them, record what happened, move to the next person --
 * all on the on-site page. Every entry is a real interaction: the
 * resident / staff or family member, this facility, now, and whoever is
 * signed in. Each draft carries its own submission id, so a retry after
 * a lost connection (or a double tap) can never save it twice.
 */

const id = z.string().uuid();

const ENTRY_TYPES = {
  visit: "resident_visit",
  staff: "facility_staff_communication",
  family: "family_communication",
} as const;
export type OnsiteEntryKind = keyof typeof ENTRY_TYPES;

const entrySchema = z.object({
  kind: z.enum(["visit", "staff", "family"]),
  facilityId: id,
  residentId: id.optional(),
  contactId: id.optional(),
  notes: z.string().trim().max(10000).optional(),
  submissionId: id,
});

export type OnsiteEntryResult =
  | { ok: true; interactionId: string; time: string }
  | { ok: false; error: string };

function revalidateOnsite(facilityId: string, residentId?: string) {
  revalidatePath(`/facilities/${facilityId}/onsite`);
  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/dashboard");
  if (residentId) revalidatePath(`/residents/${residentId}`);
}

export async function saveOnsiteEntry(input: z.input<typeof entrySchema>): Promise<OnsiteEntryResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This wasn't saved: something is missing. Please try again." };
  const { kind, facilityId, residentId, contactId, notes, submissionId } = parsed.data;
  if (kind === "visit" && !residentId) return { ok: false, error: "Choose who you visited." };
  if (kind !== "visit" && !contactId) return { ok: false, error: "Choose who you talked with." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "NOT saved: your sign-in expired. Your note is kept here -- sign in again, then tap Save." };

  const occurredAt = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("interactions")
    .insert({
      interaction_type: ENTRY_TYPES[kind],
      facility_id: facilityId,
      resident_id: residentId ?? null,
      contact_id: contactId ?? null,
      staff_member_id: user.id,
      occurred_at: occurredAt,
      notes: notes || null,
      client_submission_id: submissionId,
    })
    .select("id, occurred_at")
    .single();

  if (error?.code === "23505") {
    // Saved already (the reply to an earlier tap was lost): it's in the
    // database once, which is what matters.
    const { data: existing } = await supabase
      .from("interactions")
      .select("id, occurred_at")
      .eq("client_submission_id", submissionId)
      .maybeSingle();
    if (existing) return { ok: true, interactionId: existing.id, time: formatTimeOfDay(existing.occurred_at) ?? "" };
  }
  if (error || !created) {
    return {
      ok: false,
      error:
        error?.code === "42501"
          ? "NOT saved: you don't have access to this facility or person."
          : "NOT saved -- something went wrong. Your note is kept here; tap Save to try again.",
    };
  }

  revalidateOnsite(facilityId, residentId);
  return { ok: true, interactionId: created.id, time: formatTimeOfDay(created.occurred_at) ?? "" };
}

export type PossibleMatch = { id: string; name: string; detail: string; here: boolean };

/** People already in the CRM whose name matches what was typed, so a
 * new resident, staff or family member is only added when they're not
 * already on file. */
export async function findPossibleMatches(input: {
  kind: "resident" | "staff" | "family";
  name: string;
  facilityId: string;
  residentId?: string;
}): Promise<PossibleMatch[]> {
  const words = searchWords(input.name).filter((w) => w.length >= 2);
  if (words.length === 0 || !id.safeParse(input.facilityId).success) return [];
  const supabase = await createClient();

  if (input.kind === "resident") {
    const { data } = await supabase
      .from("residents")
      .select("id, first_name, last_name, preferred_name, room_number, status, current_facility_id, facilities(name)")
      .or(everyWordInAny(words, ["first_name", "last_name", "preferred_name"]) as string)
      .limit(6);
    return (data ?? []).map((r) => {
      const facility = r.facilities as unknown as { name: string } | null;
      const here = r.current_facility_id === input.facilityId;
      return {
        id: r.id,
        name: residentName(r),
        detail: [here ? "Lives here" : facility?.name ?? "Location unknown", r.room_number ? `room ${r.room_number}` : null, r.status !== "active" ? r.status.replace(/_/g, " ") : null]
          .filter(Boolean)
          .join(" · "),
        here,
      };
    });
  }

  const { data } = await supabase
    .from("contacts")
    .select("id, name, contact_type, organization, facility_contacts(facility_id, role_at_facility, facilities(name)), resident_contacts(resident_id)")
    .or(everyWordInAny(words, ["name"]) as string)
    .limit(6);
  return (data ?? []).map((c) => {
    const links = (c.facility_contacts ?? []) as unknown as { facility_id: string; role_at_facility: string | null; facilities: { name: string } | null }[];
    const residentLinks = (c.resident_contacts ?? []) as unknown as { resident_id: string }[];
    const atThisFacility = links.find((l) => l.facility_id === input.facilityId);
    const here = input.kind === "staff" ? !!atThisFacility : residentLinks.some((l) => l.resident_id === input.residentId);
    const where = atThisFacility
      ? [atThisFacility.role_at_facility, "here"].filter(Boolean).join(", ")
      : links[0]?.facilities?.name ?? c.organization;
    return {
      id: c.id,
      name: c.name,
      detail: [labelFor(CONTACT_TYPES, c.contact_type), where, input.kind === "family" && here ? "already their family" : null].filter(Boolean).join(" · "),
      here,
    };
  });
}

export type AddPersonResult = { ok: true; id: string; name: string } | { ok: false; error: string };

const residentInput = z.object({
  facilityId: id,
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  room: z.string().trim().max(30),
});

/** A new resident at this facility, from on-site mode. */
export async function addOnsiteResident(input: z.input<typeof residentInput>): Promise<AddPersonResult> {
  const parsed = residentInput.safeParse(input);
  if (!parsed.success || (!parsed.data.firstName && !parsed.data.lastName)) {
    return { ok: false, error: "Type at least a first or last name." };
  }
  const { facilityId, firstName, lastName, room } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your sign-in expired. Please sign in again." };

  const row = {
    first_name: firstName ? capitalizeWords(firstName) : null,
    last_name: lastName ? capitalizeWords(lastName) : null,
    room_number: room || null,
    current_facility_id: facilityId,
    created_by: user.id,
  };
  const { data, error } = await supabase.from("residents").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: "The resident was NOT added. Please try again." };

  revalidatePath("/residents");
  revalidateOnsite(facilityId);
  return { ok: true, id: data.id, name: residentName({ ...row, preferred_name: null }) };
}

const staffInput = z.object({
  facilityId: id,
  existingContactId: id.optional(),
  name: z.string().trim().max(200),
  role: z.string().trim().max(200),
  phone: z.string().trim().max(50),
});

/** A staff member at this facility: someone new, or someone already
 * on file linked to this facility. */
export async function addOnsiteStaff(input: z.input<typeof staffInput>): Promise<AddPersonResult> {
  const parsed = staffInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something is missing. Please try again." };
  const { facilityId, existingContactId, role, phone } = parsed.data;
  const name = capitalizeWords(parsed.data.name);
  if (!existingContactId && !name) return { ok: false, error: "Type their name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your sign-in expired. Please sign in again." };

  let contactId = existingContactId;
  let contactName = name;
  if (contactId) {
    const { data: existing } = await supabase.from("contacts").select("id, name").eq("id", contactId).maybeSingle();
    if (!existing) return { ok: false, error: "That person couldn't be found. Please try again." };
    contactName = existing.name;
    const { data: link } = await supabase
      .from("facility_contacts")
      .select("id, active")
      .eq("facility_id", facilityId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (link) {
      if (!link.active) await supabase.from("facility_contacts").update({ active: true }).eq("id", link.id);
      revalidateOnsite(facilityId);
      return { ok: true, id: contactId, name: contactName };
    }
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ name, contact_type: "facility_staff", phone: phone || null, created_by: user.id })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The staff member was NOT added. Please try again." };
    contactId = created.id;
  }

  const { error: linkError } = await supabase.from("facility_contacts").insert({
    facility_id: facilityId,
    contact_id: contactId,
    role_at_facility: role || null,
    is_primary_contact: false,
    created_by: user.id,
  });
  if (linkError) return { ok: false, error: "Saved, but NOT linked to this facility. Please try again." };

  revalidatePath("/contacts");
  revalidateOnsite(facilityId);
  return { ok: true, id: contactId as string, name: contactName };
}

const familyInput = z.object({
  facilityId: id,
  residentId: id,
  existingContactId: id.optional(),
  name: z.string().trim().max(200),
  relationship: z.enum(OFFERED_RELATIONSHIPS),
  phone: z.string().trim().max(50),
});

/** A family member of this resident: someone new, or someone already
 * on file linked to them. */
export async function addOnsiteFamily(input: z.input<typeof familyInput>): Promise<AddPersonResult> {
  const parsed = familyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something is missing. Please try again." };
  const { facilityId, residentId, existingContactId, relationship, phone } = parsed.data;
  const name = capitalizeWords(parsed.data.name);
  if (!existingContactId && !name) return { ok: false, error: "Type their name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your sign-in expired. Please sign in again." };

  let contactId = existingContactId;
  let contactName = name;
  if (contactId) {
    const { data: existing } = await supabase.from("contacts").select("id, name").eq("id", contactId).maybeSingle();
    if (!existing) return { ok: false, error: "That person couldn't be found. Please try again." };
    contactName = existing.name;
    const { data: link } = await supabase
      .from("resident_contacts")
      .select("id, active")
      .eq("resident_id", residentId)
      .eq("contact_id", contactId)
      .maybeSingle();
    if (link) {
      if (!link.active) await supabase.from("resident_contacts").update({ active: true }).eq("id", link.id);
      revalidateOnsite(facilityId, residentId);
      return { ok: true, id: contactId, name: contactName };
    }
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({ name, contact_type: "family_member", phone: phone || null, created_by: user.id })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "The family member was NOT added. Please try again." };
    contactId = created.id;
  }

  const { error: linkError } = await supabase.from("resident_contacts").insert({
    resident_id: residentId,
    contact_id: contactId,
    relationship_to_resident: relationship,
    is_primary_contact: false,
    created_by: user.id,
  });
  if (linkError) return { ok: false, error: "Saved, but NOT linked to this resident. Please try again." };

  revalidatePath("/contacts");
  revalidateOnsite(facilityId, residentId);
  return { ok: true, id: contactId as string, name: contactName };
}
