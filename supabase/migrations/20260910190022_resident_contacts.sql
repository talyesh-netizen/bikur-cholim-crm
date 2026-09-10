-- resident_contacts: how a contact relates to a specific resident.
--
-- Plain-English summary: this is what lets one person (e.g., Rabbi
-- Cohen) be linked to several residents, and lets a resident have
-- several family contacts — a son, a daughter, a grandchild — each with
-- their own relationship type, and one optionally flagged as the
-- Primary Contact for quick reference.

create table public.resident_contacts (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id),
  contact_id uuid not null references public.contacts (id),
  relationship_to_resident text not null check (relationship_to_resident in (
    'son',
    'daughter',
    'spouse',
    'sibling',
    'grandchild',
    'power_of_attorney',
    'friend',
    'rabbi',
    'other'
  )),
  relationship_other_description text,
  is_primary_contact boolean not null default false,
  relationship_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resident_contacts_unique unique (resident_id, contact_id, relationship_to_resident)
);

comment on table public.resident_contacts is
  'Many-to-many link between residents and contacts: who this person is to that resident, and whether they are the Primary Contact.';
comment on column public.resident_contacts.relationship_other_description is
  'Free-text detail when relationship_to_resident = other (e.g., "close family friend, no legal relationship").';
comment on column public.resident_contacts.relationship_notes is
  'Notes specific to THIS relationship (e.g., "handles medical decisions"), separate from the general notes kept on the contact record itself.';

create index resident_contacts_resident_id_idx on public.resident_contacts (resident_id);
create index resident_contacts_contact_id_idx on public.resident_contacts (contact_id);

-- Enforced at the database level: at most one Primary Contact per
-- resident, so this can never quietly end up with two "primary"
-- contacts by mistake.
create unique index resident_contacts_one_primary_per_resident_idx
  on public.resident_contacts (resident_id)
  where (is_primary_contact = true);

create trigger set_updated_at
  before update on public.resident_contacts
  for each row execute function public.set_updated_at();

alter table public.resident_contacts enable row level security;

create policy "resident contacts are readable by active staff"
  on public.resident_contacts for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add resident contacts"
  on public.resident_contacts for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update resident contacts"
  on public.resident_contacts for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());

create policy "active staff can remove resident contacts"
  on public.resident_contacts for delete
  to authenticated
  using (crm_private.is_active_staff());
