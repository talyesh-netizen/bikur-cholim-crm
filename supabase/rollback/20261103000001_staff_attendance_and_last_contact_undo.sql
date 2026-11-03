-- UNDO for 20261103000001_staff_attendance_and_last_contact.sql.
--
-- Use only with putting the earlier code back live (Vercel Instant
-- Rollback); the newer code reads these columns.
--
-- What is LOST: staff attendance recorded since the change (who was or
-- wasn't physically at a program, delivery or volunteer visit). Check
-- first:
--   select count(*) from public.interactions where lead_attended is not null;
-- Nothing else is lost: last_contact_at is calculated, not stored.

-- The view goes back to its Oct 21, 2026 shape (a column can't be
-- removed with "create or replace", so it is dropped and recreated with
-- the same rules and grants).
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
  r.sex, f.facility_type as current_facility_type
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;
revoke all on public.resident_summary from anon, authenticated;
grant select on public.resident_summary to authenticated;

alter table public.interactions drop column if exists lead_attended;
