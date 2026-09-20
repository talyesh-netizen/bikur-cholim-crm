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
  role: "staff" | "admin";
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
