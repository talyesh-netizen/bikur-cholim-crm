"use server";

import { withSaved } from "@/lib/saved-flash";
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
  name: z.string().trim().min(1, "Name is required."),
  organization: optionalText(),
  contact_type: z.enum(contactTypeValues, { message: "Please choose a type." }),
  phone: optionalText(),
  email: optionalText(),
  address: optionalText(),
  city: optionalText(),
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
  redirect(withSaved(`/contacts/${data.id}`, "contact-added"));
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
  redirect(withSaved(`/contacts/${contactId}`, "contact-saved"));
}

export async function setContactActive(contactId: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("contacts").update({ active }).eq("id", contactId);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}
