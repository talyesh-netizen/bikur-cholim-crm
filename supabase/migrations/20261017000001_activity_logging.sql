-- Build 2: activity logging (approved by the director, Oct 16, 2026).
--
-- Plain-English summary. Everything here only ADDS; no existing row is
-- changed, and old entries keep counting exactly as before until a
-- person reviews them.
--
-- 1. Staff linked to an activity (interaction_contacts). Each link is
--    either "engaged" (someone our staff actually worked with or spoke
--    to -- counts once toward staff engagements) or just present (linked,
--    not counted). Volunteers keep their own list (interaction_volunteers)
--    so volunteer reports are untouched.
-- 2. Team members (interaction_team_members): every Bikur Cholim staff
--    member who took part. The existing staff_member_id stays the lead.
--    One shared activity credits everyone on it, and counts once.
-- 3. partner_organization_id: an optional school / shul / organization.
-- 4. entered_by: who typed the entry in, filled in automatically.
-- 5. part_of_id: "Part of" another activity (a group project). The first
--    activity holds the group's volunteer count (participants); linked
--    ones never add it again.
-- 6. counted_in_id: set only when an admin reviews a suspected double
--    entry and answers "Same visit". Reports then skip the copy; the
--    copy's staff member is added as a team member of the kept entry so
--    both stay credited. duplicate_reviews records every answer
--    ("same" or "separate") so a pair is never asked about twice.
-- 7. report_snapshots: a period's totals as first recorded, saved once,
--    before the first correction in that period -- so a report already
--    sent can always be matched.

-- 1. Staff linked to an activity ------------------------------------
create table public.interaction_contacts (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  contact_id uuid not null references public.contacts (id),
  engaged boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (interaction_id, contact_id)
);

comment on table public.interaction_contacts is
  'Facility staff (or others) linked to an activity. engaged = worked with or spoke to them (counts once toward staff engagements); not engaged = only present or associated (linked, not counted).';

create index interaction_contacts_contact_id_idx on public.interaction_contacts (contact_id);

alter table public.interaction_contacts enable row level security;

create policy "interaction contacts are readable by active staff"
  on public.interaction_contacts for select to authenticated
  using (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_contacts.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

create policy "active staff can link contacts to interactions"
  on public.interaction_contacts for insert to authenticated
  with check (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_contacts.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

create policy "active staff can unlink contacts from interactions"
  on public.interaction_contacts for delete to authenticated
  using (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_contacts.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

revoke all on public.interaction_contacts from anon, authenticated;
grant select, insert, delete on public.interaction_contacts to authenticated;
grant all on public.interaction_contacts to service_role;

-- 2. Team members ---------------------------------------------------
create table public.interaction_team_members (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (interaction_id, profile_id)
);

comment on table public.interaction_team_members is
  'Bikur Cholim staff who took part in an activity besides its lead (interactions.staff_member_id). Each is credited once; the activity itself counts once.';

create index interaction_team_members_profile_id_idx on public.interaction_team_members (profile_id);

alter table public.interaction_team_members enable row level security;

create policy "interaction team members are readable by active staff"
  on public.interaction_team_members for select to authenticated
  using (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_team_members.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

create policy "active staff can add team members"
  on public.interaction_team_members for insert to authenticated
  with check (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_team_members.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

create policy "active staff can remove team members"
  on public.interaction_team_members for delete to authenticated
  using (crm_private.is_active_staff() and exists (
    select 1 from public.interactions i
    where i.id = interaction_team_members.interaction_id
      and crm_private.can_access_facility(i.facility_id)
      and crm_private.can_access_resident(i.resident_id)));

revoke all on public.interaction_team_members from anon, authenticated;
grant select, insert, delete on public.interaction_team_members to authenticated;
grant all on public.interaction_team_members to service_role;

-- 3-6. New fields on the activity ------------------------------------
alter table public.interactions
  add column if not exists partner_organization_id uuid references public.organizations (id),
  add column if not exists entered_by uuid references public.profiles (id) default auth.uid(),
  add column if not exists part_of_id uuid references public.interactions (id),
  add column if not exists counted_in_id uuid references public.interactions (id);

alter table public.interactions drop constraint if exists interactions_not_part_of_self;
alter table public.interactions add constraint interactions_not_part_of_self
  check (part_of_id is null or part_of_id <> id);
alter table public.interactions drop constraint if exists interactions_not_counted_in_self;
alter table public.interactions add constraint interactions_not_counted_in_self
  check (counted_in_id is null or counted_in_id <> id);

comment on column public.interactions.partner_organization_id is
  'Optional partner (school, shul, Jewish organization) for a program, delivery or volunteer project.';
comment on column public.interactions.entered_by is
  'Who typed this entry in (automatic). staff_member_id is who did it; they can differ. Empty on entries saved before Oct 2026.';
comment on column public.interactions.part_of_id is
  'Set when this activity is part of a group project whose first activity holds the group volunteer count (participants). Confirmed by the person logging it, never assumed.';
comment on column public.interactions.counted_in_id is
  'Set only by an admin answering "Same visit" on a suspected double entry: reports skip this copy and count the kept entry once. The copy itself is kept.';

create index if not exists interactions_partner_organization_id_idx on public.interactions (partner_organization_id) where partner_organization_id is not null;
create index if not exists interactions_entered_by_idx on public.interactions (entered_by);
create index if not exists interactions_part_of_id_idx on public.interactions (part_of_id) where part_of_id is not null;
create index if not exists interactions_counted_in_id_idx on public.interactions (counted_in_id) where counted_in_id is not null;

-- Only an admin's review may mark (or unmark) a copy as counted in
-- another entry.
create or replace function crm_private.protect_counted_in()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.counted_in_id is distinct from old.counted_in_id
     and auth.uid() is not null
     and not crm_private.is_admin() then
    raise exception 'Only an admin can mark an entry as a double entry.';
  end if;
  return new;
end;
$$;

revoke all on function crm_private.protect_counted_in() from public, anon, authenticated;

drop trigger if exists protect_counted_in on public.interactions;
create trigger protect_counted_in
  before update of counted_in_id on public.interactions
  for each row execute function crm_private.protect_counted_in();

-- Linked staff and team members, saved together in one all-or-nothing
-- call (like set_interaction_volunteers).
create or replace function public.set_interaction_people(
  p_interaction_id uuid,
  p_engaged_contact_ids uuid[],
  p_present_contact_ids uuid[],
  p_team_profile_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_lead uuid;
begin
  select staff_member_id into v_lead from public.interactions where id = p_interaction_id;
  if v_lead is null then
    raise exception 'Interaction not found, or you do not have access to it.';
  end if;

  delete from public.interaction_contacts where interaction_id = p_interaction_id;
  insert into public.interaction_contacts (interaction_id, contact_id, engaged)
  select p_interaction_id, c, true
    from (select distinct unnest(coalesce(p_engaged_contact_ids, '{}'::uuid[])) as c) e;
  -- Someone listed as both engaged and present counts as engaged.
  insert into public.interaction_contacts (interaction_id, contact_id, engaged)
  select p_interaction_id, c, false
    from (select distinct unnest(coalesce(p_present_contact_ids, '{}'::uuid[])) as c) p
   where c <> all (coalesce(p_engaged_contact_ids, '{}'::uuid[]));

  delete from public.interaction_team_members where interaction_id = p_interaction_id;
  insert into public.interaction_team_members (interaction_id, profile_id)
  select p_interaction_id, t
    from (select distinct unnest(coalesce(p_team_profile_ids, '{}'::uuid[])) as t) m
   where t <> v_lead;
end;
$$;

revoke all on function public.set_interaction_people(uuid, uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.set_interaction_people(uuid, uuid[], uuid[], uuid[]) to authenticated, service_role;

-- 6. Reviewing suspected double entries --------------------------------
create table public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  kept_id uuid not null references public.interactions (id),
  other_id uuid not null references public.interactions (id),
  decision text not null check (decision in ('same', 'separate')),
  -- For "same": the copy's lead added to the kept entry's team, so an
  -- undo can take back exactly that.
  added_team_member uuid references public.profiles (id),
  decided_by uuid references public.profiles (id) default auth.uid(),
  decided_at timestamptz not null default now(),
  constraint duplicate_reviews_two_entries check (kept_id <> other_id)
);

comment on table public.duplicate_reviews is
  'Every answer to "Is this a double entry?" on Data Quality: same (the other entry is counted in the kept one) or separate (both count). Nothing is ever decided automatically.';

create unique index duplicate_reviews_pair_idx
  on public.duplicate_reviews (least(kept_id, other_id), greatest(kept_id, other_id));

alter table public.duplicate_reviews enable row level security;

create policy "duplicate reviews are readable by active staff"
  on public.duplicate_reviews for select to authenticated
  using (crm_private.is_active_staff());

revoke all on public.duplicate_reviews from anon, authenticated;
grant select on public.duplicate_reviews to authenticated;
grant all on public.duplicate_reviews to service_role;

-- "Same visit": the copy is counted in the kept entry, its lead joins
-- the kept entry's team. Admins only; one all-or-nothing call.
create or replace function public.review_double_entry(
  p_kept_id uuid,
  p_other_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kept public.interactions;
  v_other public.interactions;
  v_added uuid;
begin
  if not crm_private.is_admin() then
    raise exception 'Only an admin can review double entries.';
  end if;
  if p_decision not in ('same', 'separate') then
    raise exception 'Unknown decision.';
  end if;
  select * into v_kept from public.interactions where id = p_kept_id;
  select * into v_other from public.interactions where id = p_other_id;
  if v_kept.id is null or v_other.id is null or p_kept_id = p_other_id then
    raise exception 'Those entries could not be found.';
  end if;
  if v_kept.counted_in_id is not null or v_other.counted_in_id is not null then
    raise exception 'One of these entries was already reviewed as a double entry.';
  end if;

  if p_decision = 'same' then
    update public.interactions set counted_in_id = p_kept_id where id = p_other_id;
    -- Anything already counted in the copy now counts in the kept entry.
    update public.interactions set counted_in_id = p_kept_id where counted_in_id = p_other_id;
    if v_other.staff_member_id <> v_kept.staff_member_id then
      insert into public.interaction_team_members (interaction_id, profile_id)
      values (p_kept_id, v_other.staff_member_id)
      on conflict do nothing
      returning profile_id into v_added;
    end if;
    insert into public.interaction_team_members (interaction_id, profile_id)
    select p_kept_id, t.profile_id from public.interaction_team_members t
     where t.interaction_id = p_other_id and t.profile_id <> v_kept.staff_member_id
    on conflict do nothing;
  end if;

  insert into public.duplicate_reviews (kept_id, other_id, decision, added_team_member, decided_by)
  values (p_kept_id, p_other_id, p_decision, v_added, auth.uid());
end;
$$;

revoke all on function public.review_double_entry(uuid, uuid, text) from public, anon;
grant execute on function public.review_double_entry(uuid, uuid, text) to authenticated, service_role;

-- Takes back one answer (e.g. tapped by mistake).
create or replace function public.undo_double_entry_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.duplicate_reviews;
begin
  if not crm_private.is_admin() then
    raise exception 'Only an admin can review double entries.';
  end if;
  select * into v_review from public.duplicate_reviews where id = p_review_id;
  if v_review.id is null then
    raise exception 'That review could not be found.';
  end if;
  if v_review.decision = 'same' then
    update public.interactions set counted_in_id = null
     where id = v_review.other_id and counted_in_id = v_review.kept_id;
    if v_review.added_team_member is not null then
      delete from public.interaction_team_members
       where interaction_id = v_review.kept_id and profile_id = v_review.added_team_member;
    end if;
  end if;
  delete from public.duplicate_reviews where id = p_review_id;
end;
$$;

revoke all on function public.undo_double_entry_review(uuid) from public, anon;
grant execute on function public.undo_double_entry_review(uuid) to authenticated, service_role;

-- 7. Totals as first recorded -------------------------------------------
create table public.report_snapshots (
  period_key text not null,
  metric text not null,
  value integer not null,
  taken_at timestamptz not null default now(),
  taken_by uuid references public.profiles (id) default auth.uid(),
  primary key (period_key, metric)
);

comment on table public.report_snapshots is
  'A period''s totals as first recorded (e.g. 2026-Q4 one-on-one visits), saved once before the first double-entry correction in that period. Never overwritten.';

alter table public.report_snapshots enable row level security;

create policy "report snapshots are readable by active staff"
  on public.report_snapshots for select to authenticated
  using (crm_private.is_active_staff());

create policy "admins save report snapshots"
  on public.report_snapshots for insert to authenticated
  with check (crm_private.is_admin());

revoke all on public.report_snapshots from anon, authenticated;
grant select, insert on public.report_snapshots to authenticated;
grant all on public.report_snapshots to service_role;
