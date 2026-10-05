-- The live resident triggers use crm_private.create_initial_facility_history()
-- and crm_private.record_facility_transfer(). The public-schema copies are
-- unused leftovers that Supabase's security scan flagged as callable via
-- the API. Locked (not dropped) on Oct 5 2026 with the director's approval.
revoke execute on function public.create_initial_facility_history() from public, anon, authenticated;
revoke execute on function public.record_facility_transfer() from public, anon, authenticated;
