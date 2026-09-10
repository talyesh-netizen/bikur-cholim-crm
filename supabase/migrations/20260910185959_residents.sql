-- residents: the Jewish residents the department supports, each linked
-- to their current facility.

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  preferred_name text,
  current_facility_id uuid not null references public.facilities (id),
  room_number text,
  phone_number text,
  rabbi_synagogue_connection text,
  jewish_interests_background text,
  kosher_food_needs text,
  holiday_support_needs text,
  visitation_needs text,
  preferred_visit_frequency text,
  status text not null default 'active' check (status in (
    'active',
    'temporarily_hospitalized',
    'moved_to_another_facility',
    'returned_home',
    'deceased',
    'unable_to_reach',
    'no_longer_receiving_services'
  )),
  private_internal_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.residents is
  'One row per resident the department supports. Always linked to their CURRENT facility; resident_facility_history holds the full timeline of past facilities.';
comment on column public.residents.private_internal_notes is
  'Treated as more sensitive than the other fields. See PRIVACY_AND_SECURITY.md: Phase One does not yet restrict this to a smaller audience than the other fields, but the column is kept separate specifically so that restriction is a small future change, not a redesign.';

-- Note: "last visit date" and "next follow-up date" are deliberately
-- NOT columns on this table. They are calculated from the interaction
-- log and the tasks table (see the views migration) so they can never
-- drift out of sync with what actually happened.

create index residents_current_facility_id_idx on public.residents (current_facility_id);
create index residents_status_idx on public.residents (status);
create index residents_last_name_idx on public.residents (last_name);

create trigger set_updated_at
  before update on public.residents
  for each row execute function public.set_updated_at();

alter table public.residents enable row level security;

create policy "residents are readable by active staff"
  on public.residents for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add residents"
  on public.residents for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update residents"
  on public.residents for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

-- No delete policy: residents are marked with a status (e.g., "Returned
-- home," "Deceased," "No longer receiving services"), never deleted, so
-- their history is never lost.
