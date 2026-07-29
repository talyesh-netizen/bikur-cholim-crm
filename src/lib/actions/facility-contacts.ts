"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONTACT_TYPES, PREFERRED_COMMUNICATION_METHODS } from "@/lib/domain/contact";

const contactTypeValues = CONTACT_TYPES.map((o) => o.value) as [string, ...string[]];
const commMethodValues = PREFERRED_COMMUNICATION_METHODS.map((o) => o.value) as [
  string,
  ...string[],
];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export type FacilityContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const facilityContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  contact_type: z.enum(contactTypeValues),
  role_at_facility: optionalText(),
  phone: optionalText(),
  email: optionalText(),
  preferred_communication_method: z.preprocess(emptyToUndefined, z.enum(commMethodValues).optional()),
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

export async function addFacilityContact(
  facilityId: string,
  _prevState: FacilityContactFormState,
  formData: FormData
): Promise<FacilityContactFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = facilityContactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const { name, contact_type, role_at_facility, phone, email, preferred_communication_method, is_primary_contact } =
    parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      name,
      contact_type,
      phone,
      email,
      preferred_communication_method,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (contactError) {
    return { error: "Something went wrong saving this contact. Please try again.", values: raw };
  }

  // The database only allows one Primary Contact per facility (see the
  // partial unique index on facility_contacts) — clear any existing one
  // first so marking a new primary never fails with a conflict.
  if (is_primary_contact) {
    await supabase
      .from("facility_contacts")
      .update({ is_primary_contact: false })
      .eq("facility_id", facilityId)
      .eq("is_primary_contact", true);
  }

  const { error: linkError } = await supabase.from("facility_contacts").insert({
    facility_id: facilityId,
    contact_id: contact.id,
    role_at_facility,
    is_primary_contact,
    created_by: user?.id,
  });

  if (linkError) {
    return { error: "Something went wrong linking this contact. Please try again.", values: raw };
  }

  revalidatePath(`/facilities/${facilityId}`);
  revalidatePath("/contacts");
  redirect(`/facilities/${facilityId}`);
}

export async function removeFacilityContact(facilityId: string, facilityContactId: string) {
  const supabase = await createClient();
  await supabase.from("facility_contacts").delete().eq("id", facilityContactId);
  revalidatePath(`/facilities/${facilityId}`);
}

export async function setPrimaryFacilityContact(facilityId: string, facilityContactId: string) {
  const supabase = await createClient();
  await supabase
    .from("facility_contacts")
    .update({ is_primary_contact: false })
    .eq("facility_id", facilityId)
    .eq("is_primary_contact", true);
  await supabase
    .from("facility_contacts")
    .update({ is_primary_contact: true })
    .eq("id", facilityContactId);
  revalidatePath(`/facilities/${facilityId}`);
}
