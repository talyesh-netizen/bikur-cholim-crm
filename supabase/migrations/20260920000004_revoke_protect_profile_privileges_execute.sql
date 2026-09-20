-- The previous migration re-declared public.protect_profile_privileges()
-- for environments where the trigger is bound to that name (see the
-- schema note in 20260920000003). Postgres lets that function be called
-- directly (e.g., via PostgREST's /rest/v1/rpc/protect_profile_privileges)
-- unless its EXECUTE privilege is revoked -- triggers themselves don't
-- need that privilege to fire, so revoking it is safe and closes the
-- gap the Supabase security linter flagged.
revoke execute on function public.protect_profile_privileges() from public;
revoke execute on function public.protect_profile_privileges() from anon, authenticated;
