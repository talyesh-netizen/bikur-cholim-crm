-- Stories (director, Oct 27, 2026). Add-only: one new table; nothing
-- existing is changed, moved or deleted.
--
-- A simple free-form log of something meaningful, written in a
-- sentence or a paragraph. It can be linked to a resident, a facility,
-- both or neither, and linked (or re-linked) later. The date is the day
-- it was written, set automatically.
--
-- * A table of its own, apart from interactions, so a story never counts
--   in any activity or Impact number.
-- * Who can see one follows the existing access rules: active staff who
--   can see its resident and facility. A story linked to neither is seen
--   by every account that isn't limited to certain facilities; a
--   limited account sees only the unlinked stories it wrote (the same
--   rule as unplaced interactions, Oct 21, 2026). Admins see all.
-- * Staff can add stories and edit the text and links; who wrote it and
--   when can't be changed. No one can delete a story from the app.
--   Every edit is kept in the change history (admins only).
--
-- Undo: supabase/rollback/20261027000002_stories_undo.sql

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  story text not null check (btrim(story) <> ''),
  -- Optional links. A story outlives a removed record: the link is
  -- simply cleared.
  resident_id uuid references public.residents (id) on delete set null,
  facility_id uuid references public.facilities (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stories is
  'Stories: free-form notes of something meaningful, optionally linked to a resident and/or a facility. Never counted in activity or Impact reports.';
comment on column public.stories.created_at is
  'When it was written -- the story''s date, set automatically.';

create index if not exists stories_created_at_idx on public.stories (created_at desc);
create index if not exists stories_resident_idx on public.stories (resident_id, created_at desc) where resident_id is not null;
create index if not exists stories_facility_idx on public.stories (facility_id, created_at desc) where facility_id is not null;
create index if not exists stories_created_by_idx on public.stories (created_by);

create trigger set_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

create trigger log_changes
  after update or delete on public.stories
  for each row execute function crm_private.log_change();

-- A story linked to neither a resident nor a facility: hidden from an
-- account limited to certain facilities, unless they wrote it.
create or replace function crm_private.can_see_unlinked_story(
  p_facility_id uuid, p_resident_id uuid, p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_facility_id is not null
    or p_resident_id is not null
    or crm_private.is_admin()
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.facility_access_scope = 'restricted'
    )
    or p_created_by = auth.uid();
$$;
revoke all on function crm_private.can_see_unlinked_story(uuid, uuid, uuid) from public, anon;
grant execute on function crm_private.can_see_unlinked_story(uuid, uuid, uuid) to authenticated;

alter table public.stories enable row level security;

create policy "stories are readable by active staff with access"
  on public.stories for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_see_unlinked_story(facility_id, resident_id, created_by)
  );

create policy "active staff can add stories they wrote"
  on public.stories for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
  );

create policy "active staff can edit stories they can see"
  on public.stories for update
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_see_unlinked_story(facility_id, resident_id, created_by)
  )
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_see_unlinked_story(facility_id, resident_id, created_by)
  );

revoke all on public.stories from anon, authenticated;
grant select, insert on public.stories to authenticated;
-- Only the story and its links can be edited.
grant update (story, resident_id, facility_id) on public.stories to authenticated;
grant all on public.stories to service_role;
