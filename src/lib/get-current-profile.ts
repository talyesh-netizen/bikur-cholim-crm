import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  full_name: string;
  email: string;
  role: "staff" | "admin";
};

/**
 * Fetches the signed-in user's profile (name, role) in one place, so
 * every page/action that needs "who is this and are they an admin"
 * doesn't duplicate the same Supabase query. Returns null if nobody is
 * signed in — shouldn't normally happen on a protected page (proxy.ts
 * already enforces sign-in), but callers should still handle it rather
 * than assume.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .single();

  return data as CurrentProfile | null;
}
