-- UNDO for 20261021000001_reporting_additions.sql (voiding, method,
-- review carrying the person, restricted access to entries with no
-- facility, views skipping voided entries).
--
-- Use only with putting the earlier code back live (Vercel Instant
-- Rollback); the newer code reads these columns.
--
-- What is LOST: void marks (voided entries would count again), methods
-- recorded on the form (Build 3's in_person tick stays), and which person
-- a "Same meeting" review added. Check first:
--   select count(*) filter (where voided_at is not null) voided,
--          count(*) filter (where method is not null) with_method
--     from public.interactions;
--   select count(*) from public.duplicate_reviews where added_contact is not null;
-- A person a review added stays linked to the kept entry (only the record
-- of who added them is dropped).
--
-- Rehearsed Oct 21, 2026 on a local copy of the full migration history:
-- after this script the database structure matched the one without the
-- migration exactly, and the migration applied cleanly again.

begin;

-- Build 2's own review functions, exactly as before.
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

alter table public.duplicate_reviews drop column if exists added_contact;

-- Access rules as before.
alter policy "interactions are readable by active staff" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));
alter policy "active staff can log interactions" on public.interactions
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));
alter policy "active staff can update interactions" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));
drop function if exists crm_private.can_access_unplaced(uuid, uuid, uuid, uuid);

-- Views as before (voided entries no longer exist after this).
create or replace view public.resident_summary with (security_invoker = true) as
select r.id, r.first_name, r.last_name, r.preferred_name, r.current_facility_id, r.room_number, r.phone_number,
  r.rabbi_synagogue_connection, r.jewish_interests_background, r.kosher_food_needs, r.holiday_support_needs,
  r.visitation_needs, r.preferred_visit_frequency, r.status,
  (select n.notes from public.resident_private_notes n where n.resident_id = r.id) as private_internal_notes,
  r.created_by, r.created_at, r.updated_at, r.referral_source,
  f.name as current_facility_name, f.geographic_cluster_id as current_facility_cluster_id,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type in ('resident_visit', 'volunteer_visit')) as last_visit_at,
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
    ( SELECT max(i.occurred_at) AS max FROM interactions i WHERE i.facility_id = f.id) AS last_visit_at,
    ( SELECT count(*) AS count FROM residents r
          WHERE r.current_facility_id = f.id AND r.status = 'active'::text) AS active_resident_count
   FROM facilities f
     LEFT JOIN geographic_clusters gc ON gc.id = f.geographic_cluster_id;

drop trigger if exists sync_method on public.interactions;
drop function if exists crm_private.sync_method();
drop trigger if exists stamp_void on public.interactions;
drop function if exists crm_private.stamp_void();
drop index if exists public.interactions_voided_at_idx;
alter table public.interactions
  drop constraint if exists interactions_method_check,
  drop constraint if exists interactions_void_reason_required,
  drop column if exists method,
  drop column if exists voided_at,
  drop column if exists voided_by,
  drop column if exists void_reason;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations
     where version = '20261021000001' or name in ('reporting_additions', '20261021000001_reporting_additions');
  end if;
end $$;

commit;
