"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { capitalizeWords } from "@/lib/format-text";

export type StaffFormState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  /** Shown once, right after creating an account, so the admin can pass
   * it along -- Supabase never lets us read a password back out again
   * after this point. */
  temporaryPassword?: string;
  saved?: boolean;
};

function generateTemporaryPassword(): string {
  return `Bc-${randomBytes(9).toString("base64url")}`;
}

const facilityAccessSchema = z.object({
  role: z.enum(["staff", "admin"]),
  facility_access_scope: z.enum(["all", "restricted"]),
  facility_ids: z.array(z.string().uuid()).optional(),
});

function extractFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

const createStaffSchema = facilityAccessSchema.extend({
  full_name: z.string().trim().min(1, "Please enter a name.").transform(capitalizeWords),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
});

export async function createStaffAccount(
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { error: "Only an admin can add staff accounts." };
  }

  const parsed = createStaffSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    role: formData.get("role") || "staff",
    facility_access_scope: formData.get("facility_access_scope") || "all",
    facility_ids: formData.getAll("facility_ids"),
  });

  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: extractFieldErrors(parsed.error) };
  }

  if (parsed.data.facility_access_scope === "restricted" && !parsed.data.facility_ids?.length) {
    return { error: "Choose at least one facility for a restricted account, or switch to full access." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server isn't configured to create accounts yet." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (createError || !created.user) {
    const alreadyExists = createError?.message?.toLowerCase().includes("already been registered");
    return {
      error: alreadyExists
        ? "Someone with that email already has an account."
        : "Something went wrong creating the account. Please try again.",
    };
  }

  // The new profile row already exists (handle_new_user trigger), with
  // role='staff'/active=false/facility_access_scope='all' defaults -- set
  // what was actually chosen, and activate it (an admin creating the
  // account is the approval, so it shouldn't need a second step), through the signed-in admin's own session so it
  // goes through the normal audited RLS path.
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, active: true, facility_access_scope: parsed.data.facility_access_scope })
    .eq("id", created.user.id);

  if (updateError) {
    return {
      error: "The account was created, but its role/access couldn't be set. Edit it from the staff list below.",
      temporaryPassword,
    };
  }

  if (parsed.data.facility_access_scope === "restricted" && parsed.data.facility_ids?.length) {
    const rows = parsed.data.facility_ids.map((facility_id) => ({
      profile_id: created.user!.id,
      facility_id,
    }));
    const { error: grantError } = await supabase.from("profile_facility_access").insert(rows);
    if (grantError) {
      return {
        error: "The account was created, but facility access couldn't be saved. Edit it from the staff list below.",
        temporaryPassword,
      };
    }
  }

  revalidatePath("/settings/staff");
  return { error: null, temporaryPassword };
}

const updateStaffSchema = facilityAccessSchema.extend({
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function updateStaffAccess(
  profileId: string,
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { error: "Only an admin can edit staff accounts." };
  }

  const parsed = updateStaffSchema.safeParse({
    role: formData.get("role"),
    active: formData.get("active"),
    facility_access_scope: formData.get("facility_access_scope"),
    facility_ids: formData.getAll("facility_ids"),
  });

  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: extractFieldErrors(parsed.error) };
  }

  if (parsed.data.facility_access_scope === "restricted" && !parsed.data.facility_ids?.length) {
    return { error: "Choose at least one facility for a restricted account, or switch to full access." };
  }

  if (profileId === profile.id && (parsed.data.role !== "admin" || !parsed.data.active)) {
    return { error: "You can't remove your own admin access or deactivate your own account." };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role,
      active: parsed.data.active,
      facility_access_scope: parsed.data.facility_access_scope,
    })
    .eq("id", profileId);

  if (updateError) {
    return { error: "Something went wrong saving these changes. Please try again." };
  }

  const { error: deleteError } = await supabase
    .from("profile_facility_access")
    .delete()
    .eq("profile_id", profileId);
  if (deleteError) {
    return { error: "Something went wrong updating facility access. Please try again." };
  }

  if (parsed.data.facility_access_scope === "restricted" && parsed.data.facility_ids?.length) {
    const rows = parsed.data.facility_ids.map((facility_id) => ({ profile_id: profileId, facility_id }));
    const { error: grantError } = await supabase.from("profile_facility_access").insert(rows);
    if (grantError) {
      return { error: "Something went wrong saving facility access. Please try again." };
    }
  }

  revalidatePath("/settings/staff");
  return { error: null, saved: true };
}

export type ResetEmailState = { error: string | null; sent?: boolean };

export async function sendPasswordResetEmail(
  email: string,
  // Required so this fits useActionState's (prevState, formData) shape
  // when bound with the email -- there's no form data to read here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ResetEmailState
): Promise<ResetEmailState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") {
    return { error: "Only an admin can send a password reset email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    return { error: "Something went wrong sending the reset email. Please try again." };
  }
  return { error: null, sent: true };
}
