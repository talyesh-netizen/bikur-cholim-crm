-- Chronological resident/facility notes that do NOT count as interactions.
-- Each note keeps the original wording plus a cleaned short version for display.

create table public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid references public.residents (id) on delete cascade,
  facility_id uuid references public.facilities (id) on delete cascade,
  raw_note text not null check (btrim(raw_note) <> ''),
  clean_note text not null check (btrim(clean_note) <> ''),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint profile_notes_exactly_one_target
    check ((resident_id is not null)::int + (facility_id is not null)::int = 1)
);

comment on table public.profile_notes is
  'Timestamped resident/facility profile notes. Separate from interactions so quick observations do not affect visit/reporting counts.';
comment on column public.profile_notes.raw_note is
  'What staff originally typed or dictated, kept verbatim for accuracy and recovery.';
comment on column public.profile_notes.clean_note is
  'Short cleaned version shown in the CRM. Usually AI-cleaned; falls back to a conservative local cleanup if AI is unavailable.';

create index profile_notes_resident_created_idx
  on public.profile_notes (resident_id, created_at desc)
  where resident_id is not null;

create index profile_notes_facility_created_idx
  on public.profile_notes (facility_id, created_at desc)
  where facility_id is not null;

create index profile_notes_created_by_idx
  on public.profile_notes (created_by);

alter table public.profile_notes enable row level security;

grant select, insert on table public.profile_notes to authenticated;
grant all on table public.profile_notes to service_role;

create policy "profile notes are readable by active staff with access"
  on public.profile_notes for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
  );

create policy "active staff can add profile notes they created"
  on public.profile_notes for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
  );

-- Deliberately no update/delete policy: notes are an append-only timeline.
