-- Undo 20261021000001_reporting_batch.sql (run by hand in the SQL
-- editor only if that migration must be backed out).
--
-- SAFE ONLY BEFORE THE NEW FEATURES HOLD REAL INFORMATION. It removes
-- void marks, methods, partners on entries, "Also there" staff, "More
-- people met" and duplicate-review answers. Before running it on a
-- database that has been used, first check what would be lost:
--
--   select count(*) filter (where voided_at is not null) voided,
--          count(*) filter (where method is not null) with_method,
--          count(*) filter (where organization_id is not null) with_partner
--     from public.interactions;
--   select count(*) from public.interaction_staff;
--   select count(*) from public.interaction_people;
--
-- Voided entries would count again once the void columns are gone.
-- Entries that only exist because of the new features (e.g. a program
-- at a partner with no facility) are kept, just without the partner.

begin;

-- Views back to exactly their previous definitions.
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

-- Access rules back to what they were.
alter policy "interactions are readable by active staff" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));
alter policy "active staff can log interactions" on public.interactions
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));
alter policy "active staff can update interactions" on public.interactions
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id) and crm_private.can_access_resident(resident_id));

drop function if exists public.combine_interactions(uuid, uuid[]);
drop function if exists public.uncombine_interaction(uuid);
drop function if exists public.set_interaction_staff(uuid, uuid[]);
drop function if exists public.set_interaction_people(uuid, uuid[]);
drop table if exists public.interaction_duplicate_reviews;
drop table if exists public.interaction_staff;
drop table if exists public.interaction_people;
drop function if exists crm_private.can_access_unplaced(uuid, uuid, uuid, uuid);

drop trigger if exists stamp_void on public.interactions;
drop function if exists crm_private.stamp_void();
drop index if exists public.interactions_not_voided_idx;
drop index if exists public.interactions_organization_id_idx;
alter table public.interactions
  drop constraint if exists interactions_void_reason_required,
  drop constraint if exists interactions_method_check,
  drop constraint if exists interactions_combined_is_void,
  drop column if exists combined_into,
  drop column if exists voided_at,
  drop column if exists voided_by,
  drop column if exists void_reason,
  drop column if exists method,
  drop column if exists organization_id;

-- Forget the migration record so it can be applied again later.
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where name = 'reporting_batch' or version = '20261021000001';
  end if;
end $$;

commit;
