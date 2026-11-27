-- UNDO for 20261127000001_attempts_trips_passing.sql.
--
-- Use only with putting the earlier code back live; the newer code reads
-- these columns and the new kind.
--
-- What is LOST (check first):
--   select count(*) from public.interactions where interaction_type = 'visit_attempt';
--   select count(*) from public.interactions where trip_id is not null;
--   select count(*) from public.residents where date_of_death is not null;
-- Attempted visits must be voided or re-kinded by a person before this
-- runs (the old rule refuses them); nothing is changed automatically.

-- Views back to their Nov 3 / Oct 21 shapes (columns can't be removed
-- with "create or replace", so they are dropped and recreated).
drop view if exists public.resident_summary;
create view public.resident_summary with (security_invoker = true) as
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
  r.sex, f.facility_type as current_facility_type,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type in ('resident_visit', 'volunteer_visit', 'resident_phone_call')
      and i.voided_at is null) as last_contact_at
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;
revoke all on public.resident_summary from anon;
grant select on public.resident_summary to authenticated;

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

alter table public.residents drop column if exists date_of_death;
drop index if exists public.interactions_trip_id_idx;
alter table public.interactions drop column if exists trip_id;

alter table public.interactions drop constraint interactions_interaction_type_check;
alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit', 'resident_phone_call', 'family_communication', 'care_navigation',
    'facility_staff_communication', 'facility_visit', 'facility_discovery_visit', 'staff_appreciation',
    'volunteer_visit', 'volunteer_meeting', 'program', 'school_engagement', 'food_delivery',
    'kosher_food_coordination', 'hospital_related_communication', 'medical_referral', 'ride_arranged',
    'referral', 'email', 'other'
  ));
