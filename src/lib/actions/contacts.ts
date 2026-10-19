"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CONTACT_TYPES,
  PREFERRED_COMMUNICATION_METHODS,
  PRIMARY_PROFILE_KINDS,
  BACKGROUND_CHECK_STATUSES,
} from "@/lib/domain/contact";
import { capitalizeOptional, capitalizeWords } from "@/lib/format-text";
import { withSaved } from "@/lib/saved-flash";
import { safeReturnTo, withParam } from "@/lib/return-to";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { contactMergeReady } from "@/lib/queries/contact-merge";

const contactTypeValues = CONTACT_TYPES.map((o) => o.value) as [string, ...string[]];
const commMethodValues = PREFERRED_COMMUNICATION_METHODS.map((o) => o.value) as [
  string,
  ...string[],
];
const primaryProfileKindValues = PRIMARY_PROFILE_KINDS.map((o) => o.value) as [string, ...string[]];
const backgroundCheckStatusValues = BACKGROUND_CHECK_STATUSES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export type ContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back what was typed so a failed save never silently discards
  // it — same pattern as lib/actions/facilities.ts and residents.ts.
  values?: Record<string, string>;
};

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").transform(capitalizeWords),
  organization: optionalText().transform(capitalizeOptional),
  contact_type: z.enum(contactTypeValues, { message: "Please choose a type." }),
  phone: optionalText(),
  email: optionalText(),
  address: optionalText(),
  city: optionalText().transform(capitalizeOptional),
  state: optionalText(),
  zip: optionalText(),
  preferred_communication_method: z.preprocess(emptyToUndefined, z.enum(commMethodValues).optional()),
  notes: optionalText(),
  primary_profile_kind: z.preprocess(emptyToUndefined, z.enum(primaryProfileKindValues).optional()).default("contact_type"),
  // Only present in the form when contact_type is "volunteer" -- absent
  // (not just empty) for every other type, so these all need defaults.
  background_check_status: z
    .preprocess(emptyToUndefined, z.enum(backgroundCheckStatusValues).optional())
    .default("not_started"),
  background_check_date: z.preprocess(emptyToUndefined, z.string().optional()),
  availability_notes: optionalText(),
});

function parseContactForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return { raw, result: contactSchema.safeParse(raw) };
}

function flattenErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** `returnTo`: a page to go back to with the new contact chosen (e.g.
 * the "Link a contact" page it was started from); else its own page. */
export async function createContact(
  returnTo: string | undefined,
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const { raw, result: parsed } = parseContactForm(formData);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Something went wrong saving this contact. Please try again.", values: raw };
  }

  revalidatePath("/contacts");
  const back = safeReturnTo(returnTo);
  redirect(withSaved(back ? withParam(back, "contact", data.id) : `/contacts/${data.id}`, "contact-added"));
}

export async function updateContact(
  contactId: string,
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const { raw, result: parsed } = parseContactForm(formData);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("contacts").update(parsed.data).eq("id", contactId).select("id");

  if (error) {
    return { error: "Something went wrong saving this contact. Please try again.", values: raw };
  }
  if (!updated || updated.length === 0) {
    return { error: "Changes NOT saved: this record no longer exists or you don't have access to it.", values: raw };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(withSaved(`/contacts/${contactId}`, "contact-saved"));
}

export async function setContactActive(contactId: string, active: boolean) {
  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("contacts").update({ active }).eq("id", contactId).select("id");
  if (error || !updated || updated.length === 0) {
    throw new Error("Could not update this contact's active status.");
  }
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(withSaved(`/contacts/${contactId}`, "contact-status-saved"));
}

export type MergeContactState = { error: string | null };

/**
 * Marks this contact as a verified duplicate of another (decision A1,
 * Oct 16, 2026): it is made inactive and pointed at the record being
 * kept, so it drops out of searches, lists and pickers. Nothing is
 * moved or deleted -- its visits and links stay on it, and its page
 * says where the kept record is. Admins only (the database enforces
 * this too).
 */
export async function markContactDuplicate(
  contactId: string,
  _prev: MergeContactState,
  formData: FormData
): Promise<MergeContactState> {
  const keepId = String(formData.get("merged_into_id") ?? "");
  if (!z.string().uuid().safeParse(keepId).success) return { error: "Choose the record to keep." };
  if (keepId === contactId) return { error: "Choose a different record than this one." };

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { error: "Only an admin can mark a contact as a duplicate." };

  const supabase = await createClient();
  if (!(await contactMergeReady(supabase))) {
    return { error: "This needs a database update that hasn't been applied yet." };
  }
  const { data: keep } = await supabase.from("contacts").select("id, merged_into_id").eq("id", keepId).maybeSingle();
  if (!keep) return { error: "That record could not be found." };
  if (keep.merged_into_id) return { error: "That record is itself a duplicate. Choose the record that is being kept." };

  const { data: updated, error } = await supabase
    .from("contacts")
    .update({ merged_into_id: keepId, active: false })
    .eq("id", contactId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { error: "Not saved: something went wrong marking this duplicate. Please try again." };
  }
  // Anything already merged into this one now points at the kept record.
  await supabase.from("contacts").update({ merged_into_id: keepId }).eq("merged_into_id", contactId);

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/contacts/${keepId}`);
  redirect(withSaved(`/contacts/${keepId}`, "contact-merged"));
}

/** Undoes a merge: the contact is active and searchable again. */
export async function undoContactMerge(contactId: string) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("Only an admin can undo a merge.");
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("contacts")
    .update({ merged_into_id: null, active: true })
    .eq("id", contactId)
    .select("id");
  if (error || !updated || updated.length === 0) throw new Error("Could not undo this merge.");
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(withSaved(`/contacts/${contactId}`, "contact-unmerged"));
}

export type LinkPlaceState = { error: string | null };

const linkPlaceSchema = z.object({
  // "facility:<id>" or "organization:<id>" -- one picker for both.
  place: z.string().regex(/^(facility|organization):[0-9a-f-]{36}$/i, "Please choose a facility or partner."),
  role: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(200).optional()),
});

/** "Works at / Represents" from the contact's own page: links this
 * person to a facility (Lisa at Anna Maria) or a Strategic Partner
 * (Kevin at LCS) -- the same links the facility's and partner's own
 * "Link a contact" make. A link that was turned off is turned back on. */
export async function linkContactToPlace(
  contactId: string,
  _prevState: LinkPlaceState,
  formData: FormData
): Promise<LinkPlaceState> {
  const parsed = linkPlaceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [kind, placeId] = parsed.data.place.split(":") as ["facility" | "organization", string];
  const role = parsed.data.role ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const table = kind === "facility" ? "facility_contacts" : "organization_contacts";
  const placeColumn = kind === "facility" ? "facility_id" : "organization_id";
  const roleColumn = kind === "facility" ? "role_at_facility" : "role_at_organization";

  const { data: existing } = await supabase
    .from(table)
    .select("id, active")
    .eq(placeColumn, placeId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (existing?.active) return { error: `Already linked to that ${kind === "facility" ? "facility" : "partner"}.` };

  const { error } = existing
    ? await supabase
        .from(table)
        .update({ active: true, ...(role ? { [roleColumn]: role } : {}) })
        .eq("id", existing.id)
    : await supabase.from(table).insert({
        [placeColumn]: placeId,
        contact_id: contactId,
        [roleColumn]: role,
        is_primary_contact: false,
        created_by: user?.id,
      });

  if (error) return { error: "That link was NOT saved -- something went wrong. Please try again." };

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(kind === "facility" ? `/facilities/${placeId}` : `/organizations/${placeId}`);
  redirect(withSaved(`/contacts/${contactId}`, "contact-place-linked"));
}
