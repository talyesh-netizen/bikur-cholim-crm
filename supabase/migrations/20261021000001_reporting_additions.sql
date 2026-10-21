-- Reporting additions on top of Build 2/3 (director, Oct 21, 2026).
--
-- Everything here only ADDS or widens. No existing entry is changed by
-- this file: older entries keep every value they have, and nothing is
-- voided, combined or filled in automatically.
--
-- 1. Voiding: a mistaken entry is marked void (a reason is required)
--    instead of deleted. It stays on file, can be restored, and drops out
--    of every count. Who voided or restored it, and when, is recorded in
--    change_log by the existing trigger; "voided by" is always the person
--    signed in.
-- 2. How it happened: in person / phone / email / video (method). Blank
--    = not recorded -- every older entry -- and never treated as in
--    person. Kept in step with Build 3's in_person tick, so either can be
--    read.
-- 3. Double-entry review ("Same visit" / "Same meeting"): the other
--    entry's contact now joins the kept entry as someone engaged, so one
--    meeting with four staff logged as four entries becomes one meeting
--    with four people. Undo takes back exactly that.
-- 4. Entries with no facility and no resident (volunteer meetings,
--    community programs): a facility-restricted account sees only the
--    ones they led or were a team member on. Everyone else: unchanged.
-- 5. Residents' "last visit" and facilities' "last contact" skip voided
--    entries.
--
-- Undo (only before any of it is used): supabase/rollback/20261021000001_reporting_additions_undo.sql

-- 1. Voiding ----------------------------------------------------------
alter table public.interactions
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id),
  add column if not exists void_reason text;

alter table public.interactions drop constraint if exists interactions_void_reason_required;
alter table public.interactions add constraint interactions_void_reason_required
  check (voided_at is null or length(btrim(coalesce(void_reason, ''))) > 0);

comment on column public.interactions.voided_at is
  'Set when the entry was voided (entered by mistake, a duplicate). It stays on file and can be restored, but is left out of every count and list.';
comment on column public.interactions.void_reason is
  'Why it was voided -- required whenever voided_at is set.';

create index if not exists interactions_voided_at_idx on public.interactions (voided_at) where voided_at is not null;

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
  end if;
  return new;
end;
$$;
revoke all on function crm_private.stamp_void() from public, anon, authenticated;

drop trigger if exists stamp_void on public.interactions;
create trigger stamp_void before update of voided_at, voided_by, void_reason on public.interactions
  for each row execute function crm_private.stamp_void();

-- 2. How it happened ----------------------------------------------------
alter table public.interactions add column if not exists method text;
alter table public.interactions drop constraint if exists interactions_method_check;
alter table public.interactions add constraint interactions_method_check
  check (method in ('in_person', 'phone', 'email', 'video'));

comment on column public.interactions.method is
  'How it happened: in_person, phone, email or video. NULL = not recorded (every entry saved before Oct 21, 2026) -- never assumed to be in person.';

-- Whichever one a save sets, the other follows; a save that sets
-- neither leaves both as they were.
create or replace function crm_private.sync_method()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.method is not null then
      new.in_person := (new.method = 'in_person');
    elsif new.in_person is true then
      new.method := 'in_person';
    end if;
  elsif new.method is distinct from old.method then
    new.in_person := case when new.method is null then null else new.method = 'in_person' end;
  elsif new.in_person is distinct from old.in_person then
    new.method := case when new.in_person is true then 'in_person' when old.method = 'in_person' then null else old.method end;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.sync_method() from public, anon, authenticated;

drop trigger if exists sync_method on public.interactions;
create trigger sync_method before insert or update of method, in_person on public.interactions
  for each row execute function crm_private.sync_method();

-- 3. Double-entry review carries the other entry's person ------------
alter table public.duplicate_reviews add column if not exists added_contact uuid references public.contacts (id);

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
  v_added_contact uuid;
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
  if v_kept.voided_at is not null or v_other.voided_at is not null then
    raise exception 'One of these entries is voided; restore it first.';
  end if;
  if p_decision = 'same' then
    update public.interactions set counted_in_id = p_kept_id where id = p_other_id;
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
    -- The person the other entry was with is someone met at the kept one.
    if v_other.contact_id is not null and v_other.contact_id is distinct from v_kept.contact_id then
      insert into public.interaction_contacts (interaction_id, contact_id, engaged)
      values (p_kept_id, v_other.contact_id, true)
      on conflict do nothing
      returning contact_id into v_added_contact;
    end if;
  end if;
  insert into public.duplicate_reviews (kept_id, other_id, decision, added_team_member, added_contact, decided_by)
  values (p_kept_id, p_other_id, p_decision, v_added, v_added_contact, auth.uid());
end;
$$;
revoke all on function public.review_double_entry(uuid, uuid, text) from public, anon;
grant execute on function public.review_double_entry(uuid, uuid, text) to authenticated, service_role;

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
    if v_review.added_contact is not null then
      delete from public.interaction_contacts
       where interaction_id = v_review.kept_id and contact_id = v_review.added_contact;
    end if;
  end if;
  delete from public.duplicate_reviews where id = p_review_id;
end;
$$;
revoke all on function public.undo_double_entry_review(uuid) from public, anon;
grant execute on function public.undo_double_entry_review(uuid) to authenticated, service_role;

-- 4. Entries with no facility and no resident --------------------------
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
      select 1 from public.interaction_team_members t
      where t.interaction_id = p_interaction_id and t.profile_id = auth.uid()
    );
$$;
revoke all on function crm_private.can_access_unplaced(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function crm_private.can_access_unplaced(uuid, uuid, uuid, uuid) to authenticated;

-- (The helper is SECURITY DEFINER, so it can read team members without
-- the two tables' rules calling each other.)
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

-- 5. Views skip voided entries (same columns, same order) ---------------
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

create or replace view public.facility_summary with (security_invoker = true) as
 SELECT f.id, f.name, f.facility_type, f.address, f.city, f.zip, f.main_phone, f.website,
    f.parent_healthcare_group, f.geographic_cluster_id, f.approx_jewish_resident_count,
    f.jewish_residents_currently_known, f.engagement_status, f.visit_priority,
    f.recommended_visit_frequency, f.kosher_food_availability, f.notes, f.active,
    f.created_by, f.created_at, f.updated_at, gc.name AS geographic_cluster_name,
    ( SELECT max(i.occurred_at) AS max FROM interactions i
          WHERE i.facility_id = f.id AND i.voided_at IS NULL) AS last_visit_at,
    ( SELECT count(*) AS count FROM residents r
          WHERE r.current_facility_id = f.id AND r.status = 'active'::text) AS active_resident_count
   FROM facilities f
     LEFT JOIN geographic_clusters gc ON gc.id = f.geographic_cluster_id;
