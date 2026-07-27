-- contacts: people who are not residents — facility staff, family
-- members, rabbis, synagogue contacts, community partners, volunteers,
-- and other referral sources.
--
-- Plain-English summary: this table stores who a person IS. How they
-- relate to a specific resident or facility (a relationship that can be
-- many-to-many — one rabbi can serve several residents) is stored
-- separately in resident_contacts and facility_contacts.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  contact_type text not null check (contact_type in (
    'facility_staff',
    'family_member',
    'rabbi',
    'synagogue_contact',
    'community_partner',
    'volunteer',
    'other_referral_source'
  )),
  phone text,
  email text,
  address text,
  city text,
  state text,
  zip text,
  preferred_communication_method text check (preferred_communication_method in ('phone', 'email', 'text', 'mail', 'no_preference')),
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is
  'One row per person who is not a resident. Relationships to specific residents/facilities live in resident_contacts and facility_contacts.';
comment on column public.contacts.active is
  'E.g., a staff member who has left a facility is marked inactive rather than deleted, preserving the history of past interactions involving them.';

create index contacts_contact_type_idx on public.contacts (contact_type);
create index contacts_active_idx on public.contacts (active);

create trigger set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

create policy "contacts are readable by active staff"
  on public.contacts for select
  to authenticated
  using (public.is_active_staff());

create policy "active staff can add contacts"
  on public.contacts for insert
  to authenticated
  with check (public.is_active_staff());

create policy "active staff can update contacts"
  on public.contacts for update
  to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());
