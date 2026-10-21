-- Reconciliation reporting batch (director, Oct 21, 2026).
--
-- Everything here is an ADDITION: new optional columns and new tables.
-- No existing entry is changed, combined or voided by this file.
--
-- 1. Voiding: a mistaken or duplicate entry is marked void (with a
--    required reason) instead of deleted. It stays on file, can be
--    restored, and drops out of every count. Who voided or restored it,
--    and when, is recorded in change_log by the existing trigger.
-- 2. How it happened: in person / phone / email / video. Left empty
--    (unknown) on every older entry -- never assumed to be in person.
-- 3. Strategic Partner on an entry: a program or meeting at a school,
--    shul or organization, with no facility. Never a facility visit.
-- 4. "Also there": other staff credited on one entry (replaces Quick
--    Log's copies), so the event itself counts once.
-- 5. "More people met": everyone at one staff meeting on one entry, so
--    a meeting with four staff is one meeting with four people.
-- 6. Duplicate review: "keep separate" answers for possible duplicates,
--    and combining (keep one entry, void the rest, move their people
--    onto it) that can be undone.
-- 7. Entries with no facility and no resident (volunteer meetings,
--    off-site programs): a facility-restricted account sees only the
--    ones they logged or were credited on. Everyone else: unchanged.
-- 8. Residents' "last visit" and facilities' "last contact" skip voided
--    entries.
--
-- To undo before anyone has used it: see the matching
-- supabase/rollbacks/20261021000001_reporting_batch_down.sql.

-- ---------------------------------------------------------------- 1-3
alter table public.interactions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id),
  add column if not exists void_reason text,
  add column if not exists combined_into uuid references public.interactions (id),
  add column if not exists method text,
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.interactions
  add constraint interactions_void_reason_required
    check (voided_at is null or length(btrim(coalesce(void_reason, ''))) > 0),
  add constraint interactions_method_check
    check (method in ('in_person', 'phone', 'email', 'video')),
  add constraint interactions_combined_is_void
    check (combined_into is null or voided_at is not null);

comment on column public.interactions.voided_at is
  'Set when the entry was voided (a mistake or duplicate). Voided entries stay on file and can be restored, but are left out of every count and list.';
comment on column public.interactions.void_reason is
  'Why it was voided -- required whenever voided_at is set.';
comment on column public.interactions.combined_into is
  'Set when this entry was combined into another one on the duplicate review screen (it is then also voided). Cleared when the combine is undone.';
comment on column public.interactions.method is
  'How it happened: in_person, phone, email or video. NULL = not recorded (every entry before Oct 2026) -- never treated as in person.';
comment on column public.interactions.organization_id is
  'The Strategic Partner (school, shul, organization) the entry was at or with. An entry with a partner and no facility is off-site and never counts as a facility visit.';

create index if not exists interactions_organization_id_idx on public.interactions (organization_id);
create index if not exists interactions_not_voided_idx on public.interactions (occurred_at) where voided_at is null;

-- Who voided it is always the person signed in, never a value sent in.
create or replace function crm_private.stamp_void()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.voided_at is not null and old.voided_at is null then
    new.voided_by := auth.uid();
  elsif new.voided_at is null then
    new.voided_by := null;
    new.void_reason := null;
    new.combined_into := null;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.stamp_void() from public, anon, authenticated;

drop trigger if exists stamp_void on public.interactions;
create trigger stamp_void before update of voided_at, void_reason, combined_into on public.interactions
  for each row execute function crm_private.stamp_void();

-- ---------------------------------------------------------------- 4-5
create table if not exists public.interaction_staff (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  -- Set when added by combining a Quick Log copy into this entry, so
  -- undoing the combine removes exactly what it added.
  source_interaction_id uuid references public.interactions (id),
  primary key (interaction_id, profile_id)
);
comment on table public.interaction_staff is
  'Other staff credited on an entry ("Also there"). The entry itself counts once; each person here gets credit for it.';

create table if not exists public.interaction_people (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  source_interaction_id uuid references public.interactions (id),
  primary key (interaction_id, contact_id)
);
comment on table public.interaction_people is
  'More people met on one entry, besides its main contact -- e.g. everyone at one staff meeting.';

create index if not exists interaction_staff_profile_idx on public.interaction_staff (profile_id);
create index if not exists interaction_people_contact_idx on public.interaction_people (contact_id);

-- ---------------------------------------------------------------- 7
-- An entry with neither a facility nor a resident has nothing for the
-- facility rule to check, so it used to be open to everyone. For a
-- restricted account it is now limited to entries they logged or are
-- credited on. Admins and unrestricted accounts: unchanged.
create or replace function crm_private.can_access_unplaced(
  p_interaction_id uuid, p_facility_id uuid, p_resident_id uuid, p_staff_member_id uuid
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
    or p_staff_member_id = auth.uid()
    or exists (
      select 1 from public.interaction_staff s
      where s.interaction_id = p_interaction_id and s.profile_id = auth.uid()
    );
$$;

revoke all on function crm_private.can_access_unplaced(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function crm_private.can_access_unplaced(uuid, uuid, uuid, uuid) to authenticated;

-- Now that interaction_staff exists, restrict the interaction rules.
-- (The function above is SECURITY DEFINER, so it can look at
-- interaction_staff without the two tables' rules calling each other.)
alter policy "interactions are readable by active staff" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_unplaced(id, facility_id, resident_id, staff_member_id));
alter policy "active staff can log interactions" on public.interactions
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_unplaced(id, facility_id, resident_id, staff_member_id));
alter policy "active staff can update interactions" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_unplaced(id, facility_id, resident_id, staff_member_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
    and crm_private.can_access_unplaced(id, facility_id, resident_id, staff_member_id));

-- The two lists follow their entry: if you can see the entry, you can
-- see and change who's on it (the same pattern as interaction_volunteers).
alter table public.interaction_staff enable row level security;
alter table public.interaction_people enable row level security;

create policy "entry staff readable with the entry" on public.interaction_staff for select to authenticated
  using (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));
create policy "entry staff added with the entry" on public.interaction_staff for insert to authenticated
  with check (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));
create policy "entry staff removed with the entry" on public.interaction_staff for delete to authenticated
  using (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));

create policy "entry people readable with the entry" on public.interaction_people for select to authenticated
  using (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));
create policy "entry people added with the entry" on public.interaction_people for insert to authenticated
  with check (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));
create policy "entry people removed with the entry" on public.interaction_people for delete to authenticated
  using (crm_private.is_active_staff() and exists (select 1 from public.interactions i where i.id = interaction_id));

revoke all on public.interaction_staff, public.interaction_people from anon;
grant select, insert, delete on public.interaction_staff, public.interaction_people to authenticated;

-- Replace an entry's "Also there" staff / "More people met", all or
-- nothing (same as set_interaction_volunteers). Rows added by a combine
-- are kept, so editing the entry can't break an undo.
create or replace function public.set_interaction_staff(p_interaction_id uuid, p_profile_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.interactions where id = p_interaction_id) then
    raise exception 'Interaction not found, or you do not have access to it.';
  end if;
  delete from public.interaction_staff
   where interaction_id = p_interaction_id and source_interaction_id is null
     and not (profile_id = any (coalesce(p_profile_ids, '{}')));
  insert into public.interaction_staff (interaction_id, profile_id)
  select p_interaction_id, p
  from (select distinct unnest(coalesce(p_profile_ids, '{}'::uuid[])) as p) ids
  where p <> (select staff_member_id from public.interactions where id = p_interaction_id)
  on conflict do nothing;
end;
$$;

create or replace function public.set_interaction_people(p_interaction_id uuid, p_contact_ids uuid[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.interactions where id = p_interaction_id) then
    raise exception 'Interaction not found, or you do not have access to it.';
  end if;
  delete from public.interaction_people
   where interaction_id = p_interaction_id and source_interaction_id is null
     and not (contact_id = any (coalesce(p_contact_ids, '{}')));
  insert into public.interaction_people (interaction_id, contact_id)
  select p_interaction_id, c
  from (select distinct unnest(coalesce(p_contact_ids, '{}'::uuid[])) as c) ids
  where c is distinct from (select contact_id from public.interactions where id = p_interaction_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.set_interaction_staff(uuid, uuid[]) from public, anon;
revoke all on function public.set_interaction_people(uuid, uuid[]) from public, anon;
grant execute on function public.set_interaction_staff(uuid, uuid[]) to authenticated;
grant execute on function public.set_interaction_people(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------- 6
create table if not exists public.interaction_duplicate_reviews (
  -- The entry ids in the group, sorted, joined with commas.
  group_key text primary key,
  decision text not null check (decision in ('kept_separate')),
  reviewed_by uuid references public.profiles (id) default auth.uid(),
  reviewed_at timestamptz not null default now()
);
comment on table public.interaction_duplicate_reviews is
  'Possible duplicates someone looked at and said are really separate entries, so the review screen stops showing them.';

alter table public.interaction_duplicate_reviews enable row level security;
create policy "duplicate reviews readable by staff" on public.interaction_duplicate_reviews for select to authenticated
  using (crm_private.is_active_staff());
create policy "duplicate reviews recorded by staff" on public.interaction_duplicate_reviews for insert to authenticated
  with check (crm_private.is_active_staff());
create policy "duplicate reviews undone by staff" on public.interaction_duplicate_reviews for delete to authenticated
  using (crm_private.is_active_staff());
revoke all on public.interaction_duplicate_reviews from anon;
grant select, insert, delete on public.interaction_duplicate_reviews to authenticated;

-- Combine: keep one entry; each other one is voided ("combined into")
-- and its staff member / main contact / extra people are added to the
-- kept one, marked with where they came from. One transaction; runs
-- with the caller's own access rules.
create or replace function public.combine_interactions(p_keep uuid, p_others uuid[])
returns void
language plpgsql
set search_path = public
as $$
declare
  keep_row public.interactions;
  other_row public.interactions;
  other_id uuid;
begin
  select * into keep_row from public.interactions where id = p_keep and voided_at is null;
  if keep_row.id is null then
    raise exception 'The entry to keep was not found, is voided, or you do not have access to it.';
  end if;
  foreach other_id in array coalesce(p_others, '{}') loop
    if other_id = p_keep then continue; end if;
    select * into other_row from public.interactions where id = other_id and voided_at is null;
    if other_row.id is null then
      raise exception 'An entry to combine was not found, is already voided, or you do not have access to it.';
    end if;
    if other_row.interaction_type <> keep_row.interaction_type then
      raise exception 'Only entries of the same kind can be combined.';
    end if;
    if other_row.staff_member_id <> keep_row.staff_member_id then
      insert into public.interaction_staff (interaction_id, profile_id, source_interaction_id)
      values (p_keep, other_row.staff_member_id, other_id) on conflict do nothing;
    end if;
    insert into public.interaction_staff (interaction_id, profile_id, source_interaction_id)
    select p_keep, s.profile_id, other_id from public.interaction_staff s
     where s.interaction_id = other_id and s.profile_id <> keep_row.staff_member_id
    on conflict do nothing;
    if other_row.contact_id is not null and other_row.contact_id is distinct from keep_row.contact_id then
      insert into public.interaction_people (interaction_id, contact_id, source_interaction_id)
      values (p_keep, other_row.contact_id, other_id) on conflict do nothing;
    end if;
    insert into public.interaction_people (interaction_id, contact_id, source_interaction_id)
    select p_keep, pp.contact_id, other_id from public.interaction_people pp
     where pp.interaction_id = other_id and pp.contact_id is distinct from keep_row.contact_id
    on conflict do nothing;
    update public.interactions
       set voided_at = now(), void_reason = 'Combined into another entry (duplicate review)', combined_into = p_keep
     where id = other_id;
  end loop;
end;
$$;

-- Undo a combine: restore the entry and take back exactly what the
-- combine added to the kept one.
create or replace function public.uncombine_interaction(p_other uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  kept uuid;
begin
  select combined_into into kept from public.interactions where id = p_other;
  if kept is null then
    raise exception 'That entry was not combined, or you do not have access to it.';
  end if;
  delete from public.interaction_staff where interaction_id = kept and source_interaction_id = p_other;
  delete from public.interaction_people where interaction_id = kept and source_interaction_id = p_other;
  update public.interactions set voided_at = null where id = p_other;
end;
$$;

revoke all on function public.combine_interactions(uuid, uuid[]) from public, anon;
revoke all on function public.uncombine_interaction(uuid) from public, anon;
grant execute on function public.combine_interactions(uuid, uuid[]) to authenticated;
grant execute on function public.uncombine_interaction(uuid) to authenticated;

-- ---------------------------------------------------------------- 8
-- Same columns, same order; only "and not voided" added.
create or replace view public.resident_summary with (security_invoker = true) as
select r.id, r.first_name, r.last_name, r.preferred_name, r.current_facility_id, r.room_number, r.phone_number,
  r.rabbi_synagogue_connection, r.jewish_interests_background, r.kosher_food_needs, r.holiday_support_needs,
  r.visitation_needs, r.preferred_visit_frequency, r.status,
  (select n.notes from public.resident_private_notes n where n.resident_id = r.id) as private_internal_notes,
  r.created_by, r.created_at, r.updated_at, r.referral_source,
  f.name as current_facility_name, f.geographic_cluster_id as current_facility_cluster_id,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type in ('resident_visit', 'volunteer_visit')
      and i.voided_at is null) as last_visit_at,
  (select min(t.due_date) from public.tasks t
    where t.resident_id = r.id and t.status in ('open', 'in_progress', 'waiting') and t.due_date is not null) as next_follow_up_date,
  (select pc.id from public.resident_contacts pc
    where pc.resident_id = r.id and pc.is_primary_contact = true limit 1) as primary_contact_resident_contact_id,
  r.sex, f.facility_type as current_facility_type
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;

create or replace view public.facility_summary
with (security_invoker = true) as
 SELECT f.id,
    f.name,
    f.facility_type,
    f.address,
    f.city,
    f.zip,
    f.main_phone,
    f.website,
    f.parent_healthcare_group,
    f.geographic_cluster_id,
    f.approx_jewish_resident_count,
    f.jewish_residents_currently_known,
    f.engagement_status,
    f.visit_priority,
    f.recommended_visit_frequency,
    f.kosher_food_availability,
    f.notes,
    f.active,
    f.created_by,
    f.created_at,
    f.updated_at,
    gc.name AS geographic_cluster_name,
    ( SELECT max(i.occurred_at) AS max
           FROM interactions i
          WHERE i.facility_id = f.id AND i.voided_at IS NULL) AS last_visit_at,
    ( SELECT count(*) AS count
           FROM residents r
          WHERE r.current_facility_id = f.id AND r.status = 'active'::text) AS active_resident_count
   FROM facilities f
     LEFT JOIN geographic_clusters gc ON gc.id = f.geographic_cluster_id;
