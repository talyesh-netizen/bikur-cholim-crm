-- organizations, organization_contacts, profile_facility_access, and
-- resident_summary were created/recreated after the original
-- least-privilege lockdown (20260920000005 for organizations/
-- organization_contacts, 20260920000003 for profile_facility_access,
-- and the resident_facility_cluster migration's drop+recreate for
-- resident_summary) and inherited Supabase's default broad grants to
-- anon and authenticated instead of the explicit least-privilege
-- grants every other table has. RLS already blocks anon in practice
-- (every policy on these is `to authenticated` only), but the
-- table-level grants should say so directly rather than leaning on
-- RLS as the only backstop -- matching every other table.

revoke all on public.organizations from anon, authenticated;
grant select, insert, update on public.organizations to authenticated;

revoke all on public.organization_contacts from anon, authenticated;
grant select, insert, update, delete on public.organization_contacts to authenticated;

revoke all on public.profile_facility_access from anon, authenticated;
grant select, insert, update, delete on public.profile_facility_access to authenticated;

revoke all on public.resident_summary from anon, authenticated;
grant select on public.resident_summary to authenticated;
