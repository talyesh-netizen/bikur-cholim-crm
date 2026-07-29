"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PREFERRED_COMMUNICATION_METHODS, RESIDENT_CONTACT_RELATIONSHIPS } from "@/lib/domain/contact";

const relationshipValues = RESIDENT_CONTACT_RELATIONSHIPS.map((o) => o.value) as [
  string,
  ...string[],
];
const commMethodValues = PREFERRED_COMMUNICATION_METHODS.map((o) => o.value) as [
  string,
  ...string[],
];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export type FamilyContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const familyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  relationship_to_resident: z.enum(relationshipValues),
  relationship_other_description: optionalText(),
  phone: optionalText(),
  email: optionalText(),
  address: optionalText(),
  city: optionalText(),
  state: optionalText(),
  zip: optionalText(),
  preferred_communication_method: z.preprocess(emptyToUndefined, z.enum(commMethodValues).optional()),
  relationship_notes: optionalText(),
  // Checkboxes only appear in form data when checked.
  is_primary_contact: z.preprocess((val) => val === "on", z.boolean()),
});

function flattenErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function addFamilyContact(
  residentId: string,
  _prevState: FamilyContactFormState,
  formData: FormData
): Promise<FamilyContactFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = familyContactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const {
    name,
    relationship_to_resident,
    relationship_other_description,
    phone,
    email,
    address,
    city,
    state,
    zip,
    preferred_communication_method,
    relationship_notes,
    is_primary_contact,
  } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      name,
      contact_type: relationship_to_resident === "rabbi" ? "rabbi" : "family_member",
      phone,
      email,
      address,
      city,
      state,
      zip,
      preferred_communication_method,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (contactError) {
    return { error: "Something went wrong saving this contact. Please try again.", values: raw };
  }

  // The database only allows one Primary Contact per resident (see the
  // partial unique index on resident_contacts) — clear any existing one
  // first so marking a new primary never fails with a conflict.
  if (is_primary_contact) {
    await supabase
      .from("resident_contacts")
      .update({ is_primary_contact: false })
      .eq("resident_id", residentId)
      .eq("is_primary_contact", true);
  }

  const { error: linkError } = await supabase.from("resident_contacts").insert({
    resident_id: residentId,
    contact_id: contact.id,
    relationship_to_resident,
    relationship_other_description,
    relationship_notes,
    is_primary_contact,
    created_by: user?.id,
  });

  if (linkError) {
    return { error: "Something went wrong linking this contact. Please try again.", values: raw };
  }

  revalidatePath(`/residents/${residentId}`);
  revalidatePath("/contacts");
  redirect(`/residents/${residentId}`);
}

export async function removeResidentContact(residentId: string, residentContactId: string) {
  const supabase = await createClient();
  await supabase.from("resident_contacts").delete().eq("id", residentContactId);
  revalidatePath(`/residents/${residentId}`);
}

export async function setPrimaryResidentContact(residentId: string, residentContactId: string) {
  const supabase = await createClient();
  await supabase
    .from("resident_contacts")
    .update({ is_primary_contact: false })
    .eq("resident_id", residentId)
    .eq("is_primary_contact", true);
  await supabase
    .from("resident_contacts")
    .update({ is_primary_contact: true })
    .eq("id", residentContactId);
  revalidatePath(`/residents/${residentId}`);
}
