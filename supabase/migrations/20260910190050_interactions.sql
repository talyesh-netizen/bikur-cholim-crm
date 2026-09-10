-- interactions: the central log of visits, calls, programs, and other
-- activity. This single table powers both the "past interactions" list
-- on a facility page and the one on a resident page — same underlying
-- records, just filtered differently in each place.

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  interaction_type text not null check (interaction_type in (
    'resident_visit',
    'resident_phone_call',
    'family_communication',
    'facility_staff_communication',
    'facility_discovery_visit',
    'volunteer_visit',
    'program',
    'kosher_food_coordination',
    'hospital_related_communication',
    'referral',
    'email',
    'other'
  )),
  facility_id uuid references public.facilities (id),
  resident_id uuid references public.residents (id),
  contact_id uuid references public.contacts (id),
  staff_member_id uuid not null references public.profiles (id),
  notes text,
  outcome text,
  follow_up_needed boolean not null default false,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.interactions is
  'One row per logged visit, call, program, or other activity. Some interactions (e.g., a facility discovery visit) are not about one specific resident, so resident_id is optional.';
comment on column public.interactions.staff_member_id is
  'The staff member who completed/logged this interaction.';

create index interactions_facility_id_idx on public.interactions (facility_id);
create index interactions_resident_id_idx on public.interactions (resident_id);
create index interactions_contact_id_idx on public.interactions (contact_id);
create index interactions_occurred_at_idx on public.interactions (occurred_at);
create index interactions_interaction_type_idx on public.interactions (interaction_type);

create trigger set_updated_at
  before update on public.interactions
  for each row execute function public.set_updated_at();

alter table public.interactions enable row level security;

create policy "interactions are readable by active staff"
  on public.interactions for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can log interactions"
  on public.interactions for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update interactions"
  on public.interactions for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

-- interaction_volunteers: which volunteers (drawn from the contacts
-- table) were involved in a given interaction. A separate table because
-- one visit can involve several volunteers, and one volunteer can be
-- part of many visits over time.
create table public.interaction_volunteers (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  primary key (interaction_id, contact_id)
);

comment on table public.interaction_volunteers is
  'Which volunteers (contacts with contact_type = volunteer, typically) took part in a given interaction.';

alter table public.interaction_volunteers enable row level security;

create policy "interaction volunteers are readable by active staff"
  on public.interaction_volunteers for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can record interaction volunteers"
  on public.interaction_volunteers for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can remove interaction volunteers"
  on public.interaction_volunteers for delete
  to authenticated
  using (crm_private.is_active_staff());
