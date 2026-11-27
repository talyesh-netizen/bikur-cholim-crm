-- Everyday cleanup, TEST batch (director and ChatGPT, Nov 27, 2026).
-- Add-only. Undo: supabase/rollback/20261127000001_attempts_trips_passing_undo.sql
--
-- 1. "Attempted visit" (visit_attempt): we went to see a resident and they
--    were unavailable. Counts as a facility visit and a staff visit (staff
--    were there in person); never as a completed visit with the resident.
-- 2. interactions.trip_id: entries saved during one On-site visit share it,
--    so two separate trips to the same facility on the same day count as
--    two facility visits. Empty on every older entry (counted as before:
--    each facility once a day).
-- 3. residents.date_of_death: optional; earlier notes are kept as they are.
-- 4. resident_summary.last_attempt_at (newest Attempted visit).
-- 5. facility_summary.active_resident_count includes residents in hospital
--    who are still linked to the facility.

alter table public.interactions drop constraint interactions_interaction_type_check;
alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit',
    'visit_attempt',
    'resident_phone_call',
    'family_communication',
    'care_navigation',
    'facility_staff_communication',
    'facility_visit',
    'facility_discovery_visit',
    'staff_appreciation',
    'volunteer_visit',
    'volunteer_meeting',
    'program',
    'school_engagement',
    'food_delivery',
    'kosher_food_coordination',
    'hospital_related_communication',
    'medical_referral',
    'ride_arranged',
    'referral',
    'email',
    'other'
  ));

alter table public.interactions add column if not exists trip_id uuid;
comment on column public.interactions.trip_id is
  'One On-site visit (trip) to a facility (Nov 27, 2026). Null = not recorded: counted as one visit per facility per day.';
create index if not exists interactions_trip_id_idx on public.interactions (trip_id) where trip_id is not null;

alter table public.residents add column if not exists date_of_death date;
comment on column public.residents.date_of_death is
  'Optional date of passing (Nov 27, 2026). Never guessed.';

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
  r.sex, f.facility_type as current_facility_type,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type in ('resident_visit', 'volunteer_visit', 'resident_phone_call')
      and i.voided_at is null) as last_contact_at,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type = 'visit_attempt'
      and i.voided_at is null) as last_attempt_at,
  r.date_of_death
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
          WHERE r.current_facility_id = f.id AND r.status = ANY (ARRAY['active'::text, 'temporarily_hospitalized'::text])) AS active_resident_count
   FROM facilities f
     LEFT JOIN geographic_clusters gc ON gc.id = f.geographic_cluster_id;

revoke all on public.resident_summary from anon;
grant select on public.resident_summary to authenticated;
revoke all on public.facility_summary from anon;
grant select on public.facility_summary to authenticated;
