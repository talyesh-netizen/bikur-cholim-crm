-- Supabase's performance advisor flags "multiple permissive policies":
-- geographic_clusters and profile_facility_access each had a `FOR ALL`
-- admin policy that overlapped with a separate `FOR SELECT` staff-read
-- policy, so every SELECT ran both. is_admin() already requires
-- active = true, i.e. every admin is also active staff, so the SELECT
-- half of the admin policy was always redundant -- splitting the admin
-- policy to INSERT/UPDATE/DELETE only (Postgres has no FOR INSERT,
-- UPDATE, DELETE shorthand, so these are three separate policies)
-- removes the duplicate without changing who can do what.
drop policy if exists "only admins manage clusters" on public.geographic_clusters;

create policy "admins insert clusters"
  on public.geographic_clusters for insert
  to authenticated
  with check (crm_private.is_admin());

create policy "admins update clusters"
  on public.geographic_clusters for update
  to authenticated
  using (crm_private.is_admin())
  with check (crm_private.is_admin());

create policy "admins delete clusters"
  on public.geographic_clusters for delete
  to authenticated
  using (crm_private.is_admin());

drop policy if exists "only admins manage facility access grants" on public.profile_facility_access;

create policy "admins insert facility access grants"
  on public.profile_facility_access for insert
  to authenticated
  with check (crm_private.is_admin());

create policy "admins update facility access grants"
  on public.profile_facility_access for update
  to authenticated
  using (crm_private.is_admin())
  with check (crm_private.is_admin());

create policy "admins delete facility access grants"
  on public.profile_facility_access for delete
  to authenticated
  using (crm_private.is_admin());

-- profiles had two separate FOR UPDATE policies (own-profile, any-profile
-- for admins), so every update ran both. Merged into one with an OR --
-- same effective permissions, one policy evaluation instead of two.
drop policy if exists "admins can update any profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;

create policy "admins or the owner can update a profile"
  on public.profiles for update
  to authenticated
  using (crm_private.is_admin() or id = (select auth.uid()))
  with check (crm_private.is_admin() or id = (select auth.uid()));
