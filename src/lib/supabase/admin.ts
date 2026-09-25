import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the few things the normal RLS-governed
 * clients can't do: creating or removing a sign-in (an auth.users row)
 * for a staff member (src/lib/actions/staff.ts, admin-only), and the
 * daily reminder cron job, which has no signed-in user
 * (src/app/api/cron/task-reminders/route.ts, protected by CRON_SECRET).
 * Server-only: never import this into a client component, and never use
 * it for anything a signed-in person's own session could do instead --
 * it bypasses row-level security entirely.
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
