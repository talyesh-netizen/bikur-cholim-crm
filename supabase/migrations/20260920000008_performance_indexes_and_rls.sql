-- Housekeeping fixes flagged by Supabase's own performance advisor.
-- No behavior change -- purely indexes and one RLS policy rewritten to
-- do the same check more efficiently.

-- Missing indexes on foreign keys -- speeds up lookups like "who
-- created this record" and any cascading checks Postgres has to do on
-- the referenced table.
create index if not exists contacts_created_by_idx on public.contacts (created_by);
create index if not exists facilities_created_by_idx on public.facilities (created_by);
create index if not exists facility_contacts_created_by_idx on public.facility_contacts (created_by);
create index if not exists interaction_volunteers_contact_id_idx on public.interaction_volunteers (contact_id);
create index if not exists interactions_staff_member_id_idx on public.interactions (staff_member_id);
create index if not exists organization_contacts_created_by_idx on public.organization_contacts (created_by);
create index if not exists organizations_created_by_idx on public.organizations (created_by);
create index if not exists resident_contacts_created_by_idx on public.resident_contacts (created_by);
create index if not exists resident_facility_history_created_by_idx on public.resident_facility_history (created_by);
create index if not exists residents_created_by_idx on public.residents (created_by);
create index if not exists tasks_contact_id_idx on public.tasks (contact_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);

-- auth.uid() was being re-evaluated per row in this policy instead of
-- once per query -- wrapping it in a subquery lets Postgres cache the
-- result, same fix Supabase's linter recommends.
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
