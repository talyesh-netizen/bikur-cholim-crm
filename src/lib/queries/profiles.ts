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
