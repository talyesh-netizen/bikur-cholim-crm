-- facilities: nursing homes, assisted living communities, rehab centers,
-- and similar places the department tracks.

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  facility_type text not null check (facility_type in (
    'nursing_home',
    'assisted_living',
    'rehabilitation_center',
    'memory_care',
    'independent_living',
    'senior_apartment',
    'hospital',
    'other'
  )),
  address text,
  city text,
  zip text,
  main_phone text,
  website text,
  parent_healthcare_group text,
  geographic_cluster_id uuid references public.geographic_clusters (id),
  approx_jewish_resident_count integer check (approx_jewish_resident_count is null or approx_jewish_resident_count >= 0),
  jewish_residents_currently_known boolean not null default false,
  engagement_status text not null default 'not_contacted' check (engagement_status in (
    'not_contacted',
    'initial_contact',
    'staff_relationship_developing',
    'active_facility',
    'recurring_visits',
    'recurring_programming',
    'no_known_jewish_residents',
    'follow_up_needed'
  )),
  visit_priority text not null default 'medium' check (visit_priority in ('high', 'medium', 'low')),
  recommended_visit_frequency text,
  kosher_food_availability text check (kosher_food_availability in ('yes', 'no', 'some_options', 'unknown')),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.facilities is
  'One row per facility (nursing home, assisted living, rehab, etc.) the department tracks.';
comment on column public.facilities.approx_jewish_resident_count is
  'An approximate number, since exact counts often are not knowable.';
comment on column public.facilities.jewish_residents_currently_known is
  'Useful to record even before any individual resident record has been added for this facility.';
comment on column public.facilities.active is
  'Whether this facility is currently tracked. Inactive facilities are hidden from normal lists but not deleted, so history is preserved.';

-- Note: "last visit date" is deliberately NOT a column on this table.
-- It is calculated from the interaction log (see the views migration)
-- so it can never drift out of sync with what actually happened.

create index facilities_geographic_cluster_id_idx on public.facilities (geographic_cluster_id);
create index facilities_active_idx on public.facilities (active);
create index facilities_engagement_status_idx on public.facilities (engagement_status);

create trigger set_updated_at
  before update on public.facilities
  for each row execute function public.set_updated_at();

alter table public.facilities enable row level security;

create policy "facilities are readable by active staff"
  on public.facilities for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add facilities"
  on public.facilities for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update facilities"
  on public.facilities for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

-- No delete policy: facilities are deactivated (active = false), never
-- deleted, so that residents/interactions/tasks tied to them never lose
-- their connection.
