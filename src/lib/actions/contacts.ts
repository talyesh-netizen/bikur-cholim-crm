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

export type ContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  // Echoes back what was typed so a failed save never silently discards
  // it — same pattern as lib/actions/facilities.ts and residents.ts.
  values?: Record<string, string>;
};

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  organization: optionalText(),
  contact_type: z.enum(contactTypeValues),
  phone: optionalText(),
  email: optionalText(),
  address: optionalText(),
  city: optionalText(),
  state: optionalText(),
  zip: optionalText(),
  preferred_communication_method: z.preprocess(emptyToUndefined, z.enum(commMethodValues).optional()),
  notes: optionalText(),
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

export async function createContact(
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
  redirect(`/contacts/${data.id}`);
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
  const { error } = await supabase.from("contacts").update(parsed.data).eq("id", contactId);

  if (error) {
    return { error: "Something went wrong saving this contact. Please try again.", values: raw };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  redirect(`/contacts/${contactId}`);
}

export async function setContactActive(contactId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("contacts").update({ active }).eq("id", contactId);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}
