-- facility_contacts: how a contact relates to a specific facility.
--
-- Plain-English summary: same idea as resident_contacts, for facility
-- staff. A regional director who oversees several facilities can be
-- correctly linked to all of them, rather than being forced into just
-- one.

create table public.facility_contacts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  contact_id uuid not null references public.contacts (id),
  role_at_facility text,
  is_primary_contact boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_contacts_unique unique (facility_id, contact_id)
);

comment on table public.facility_contacts is
  'Many-to-many link between facilities and contacts: e.g., which staff members work at this facility, and who the main point of contact is.';

create index facility_contacts_facility_id_idx on public.facility_contacts (facility_id);
create index facility_contacts_contact_id_idx on public.facility_contacts (contact_id);

create unique index facility_contacts_one_primary_per_facility_idx
  on public.facility_contacts (facility_id)
  where (is_primary_contact = true);

create trigger set_updated_at
  before update on public.facility_contacts
  for each row execute function public.set_updated_at();

alter table public.facility_contacts enable row level security;

create policy "facility contacts are readable by active staff"
  on public.facility_contacts for select
  to authenticated
  using (public.is_active_staff());

create policy "active staff can add facility contacts"
  on public.facility_contacts for insert
  to authenticated
  with check (public.is_active_staff());

create policy "active staff can update facility contacts"
  on public.facility_contacts for update
  to authenticated
  using (public.is_active_staff())
  with check (public.is_active_staff());

create policy "active staff can remove facility contacts"
  on public.facility_contacts for delete
  to authenticated
  using (public.is_active_staff());
