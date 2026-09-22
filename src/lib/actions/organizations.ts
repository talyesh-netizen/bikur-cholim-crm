"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORGANIZATION_TYPES } from "@/lib/domain/organization";
import { capitalizeOptional, capitalizeWords } from "@/lib/format-text";

const organizationTypeValues = ORGANIZATION_TYPES.map((o) => o.value) as [string, ...string[]];
const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);
const optionalText = () => z.preprocess(emptyToUndefined, z.string().trim().optional());

export type OrganizationFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const organizationSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required.").transform(capitalizeWords),
  organization_type: z.enum(organizationTypeValues, { message: "Please choose a type." }),
  address: optionalText(),
  city: optionalText().transform(capitalizeOptional),
  state: optionalText(),
  zip: optionalText(),
  main_phone: optionalText(),
  website: optionalText(),
  notes: optionalText(),
});

function flattenErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createOrganization(
  _prevState: OrganizationFormState,
  formData: FormData
): Promise<OrganizationFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("organizations")
    .insert({ ...parsed.data, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    return { error: "Something went wrong saving this organization. Please try again.", values: raw };
  }

  revalidatePath("/organizations");
  redirect(`/organizations/${data.id}`);
}

export async function updateOrganization(
  organizationId: string,
  _prevState: OrganizationFormState,
  formData: FormData
): Promise<OrganizationFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = organizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update(parsed.data).eq("id", organizationId);

  if (error) {
    return { error: "Something went wrong saving this organization. Please try again.", values: raw };
  }

  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/organizations/${organizationId}`);
}

export async function setOrganizationActive(organizationId: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ active }).eq("id", organizationId);
  if (error) {
    throw new Error("Could not update this organization's active status.");
  }
  revalidatePath("/organizations");
  revalidatePath(`/organizations/${organizationId}`);
}

export type OrganizationContactFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const linkExistingSchema = z.object({
  contact_id: z.string().uuid("Please choose a contact."),
  role_at_organization: optionalText(),
  is_primary_contact: z.preprocess((val) => val === "on", z.boolean()),
});

/** Links an existing contact to this organization -- the common case,
 * since most people worth linking already exist as a contact. */
export async function addExistingOrganizationContact(
  organizationId: string,
  _prevState: OrganizationContactFormState,
  formData: FormData
): Promise<OrganizationContactFormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = linkExistingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: flattenErrors(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (parsed.data.is_primary_contact) {
    await supabase
      .from("organization_contacts")
      .update({ is_primary_contact: false })
      .eq("organization_id", organizationId)
      .eq("is_primary_contact", true);
  }

  const { error } = await supabase.from("organization_contacts").insert({
    organization_id: organizationId,
    contact_id: parsed.data.contact_id,
    role_at_organization: parsed.data.role_at_organization,
    is_primary_contact: parsed.data.is_primary_contact,
    created_by: user?.id,
  });

  if (error) {
    return {
      error: error.message.includes("duplicate key")
        ? "That contact is already linked to this organization."
        : "Something went wrong linking this contact. Please try again.",
      values: raw,
    };
  }

  revalidatePath(`/organizations/${organizationId}`);
  redirect(`/organizations/${organizationId}`);
}

export async function setOrganizationContactActive(
  organizationId: string,
  organizationContactId: string,
  active: boolean
) {
  const supabase = await createClient();
  // Deactivating clears "Primary" too -- an inactive link staying
  // marked primary would be a confusing state to reactivate back into.
  await supabase
    .from("organization_contacts")
    .update(active ? { active } : { active, is_primary_contact: false })
    .eq("id", organizationContactId);
  revalidatePath(`/organizations/${organizationId}`);
}

export async function setPrimaryOrganizationContact(organizationId: string, organizationContactId: string) {
  const supabase = await createClient();
  await supabase
    .from("organization_contacts")
    .update({ is_primary_contact: false })
    .eq("organization_id", organizationId)
    .eq("is_primary_contact", true);
  await supabase
    .from("organization_contacts")
    .update({ is_primary_contact: true })
    .eq("id", organizationContactId);
  revalidatePath(`/organizations/${organizationId}`);
}
