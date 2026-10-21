import { createClient } from "@/lib/supabase/server";

export type StaffProfile = { id: string; full_name: string };

export async function listActiveStaff(): Promise<StaffProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("active", true)
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffProfile[];
}

export type StaffAccount = {
  id: string;
  full_name: string;
  email: string;
  role: "staff" | "admin" | "intern";
  active: boolean;
  facility_access_scope: "all" | "restricted";
  facility_ids: string[];
};

/** Every staff/admin account, plus which facilities a restricted
 * account is granted (empty for an 'all'-access account) -- the data
 * behind the admin-only Staff settings page. */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, active, facility_access_scope, profile_facility_access(facility_id)"
    )
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { profile_facility_access, ...profile } = row as unknown as StaffAccount & {
      profile_facility_access: { facility_id: string }[];
    };
    return {
      ...profile,
      facility_ids: (profile_facility_access ?? []).map((g) => g.facility_id),
    };
  });
}

/** One staff member's name (active or not), e.g. who voided an entry. */
export async function getProfileName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return (data as { full_name: string } | null)?.full_name ?? null;
}
