-- organizations: synagogues, schools, and other community partner
-- organizations the department has a strategic relationship with --
-- not tied to any one facility, and often represented by several
-- people (a rabbi, an office contact, a school director), the same way
-- a facility has several facility_contacts.
--
-- Plain-English summary: a contact's "organization" was previously
-- just a free-text field with no real record behind it. This gives
-- Shuls and similar community organizations a real profile of their
-- own -- like a lightweight Facility -- that several contacts can be
-- linked to at once.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'other' check (organization_type in (
    'synagogue',
    'school',
    'community_partner',
    'other'
  )),
  address text,
  city text,
  state text,
  zip text,
  main_phone text,
  website text,
  notes text,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'One row per synagogue, school, or other community partner organization -- a strategic relationship not tied to a specific facility. Contacts (people) are linked via organization_contacts, the same pattern as facility_contacts.';

create index organizations_active_idx on public.organizations (active);
create index organizations_organization_type_idx on public.organizations (organization_type);

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

create policy "organizations are readable by active staff"
  on public.organizations for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add organizations"
  on public.organizations for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update organizations"
  on public.organizations for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

-- No delete policy: organizations are deactivated (active = false),
-- never deleted, same as facilities.

-- organization_contacts: how a contact relates to a specific
-- organization -- exactly the facility_contacts pattern, so a rabbi or
-- office contact linked to a Shul shows up on that Shul's page, and one
-- person can be linked to more than one organization.
create table public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  contact_id uuid not null references public.contacts (id),
  role_at_organization text,
  is_primary_contact boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_contacts_unique unique (organization_id, contact_id)
);

comment on table public.organization_contacts is
  'Many-to-many link between organizations and contacts: which people represent this Shul/school/partner, and who the main point of contact is.';

create index organization_contacts_organization_id_idx on public.organization_contacts (organization_id);
create index organization_contacts_contact_id_idx on public.organization_contacts (contact_id);

create unique index organization_contacts_one_primary_per_org_idx
  on public.organization_contacts (organization_id)
  where (is_primary_contact = true);

create trigger set_updated_at
  before update on public.organization_contacts
  for each row execute function public.set_updated_at();

alter table public.organization_contacts enable row level security;

create policy "organization contacts are readable by active staff"
  on public.organization_contacts for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add organization contacts"
  on public.organization_contacts for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update organization contacts"
  on public.organization_contacts for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

create policy "active staff can remove organization contacts"
  on public.organization_contacts for delete
  to authenticated
  using (crm_private.is_active_staff());
