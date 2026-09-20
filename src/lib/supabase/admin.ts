import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the one thing the normal RLS-governed
 * clients can't do: creating a brand-new sign-in (an auth.users row) for
 * a new staff member. Never import this outside src/lib/actions, and
 * never use it for anything a signed-in admin's own session could do
 * instead -- it bypasses row-level security entirely.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "This server isn't configured to create staff accounts yet -- SUPABASE_SERVICE_ROLE_KEY is missing from its environment variables. An admin needs to add it (from the Supabase dashboard's Settings > API page) before this will work."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
