-- Final cleanup batch (director and ChatGPT, Nov 3, 2026). Add-only:
-- one new empty column and one new calculated column on a view. Nothing
-- existing is changed, moved or deleted.
--
-- 1. lead_attended (decisions Q4 and D4): whether the entry's lead
--    ("Done by", first person) was physically there.
--      null  = not recorded -- every entry saved before this change.
--              Reports keep today's rule for it, except programs and
--              food deliveries, whose staff attendance is then shown as
--              "not recorded" (never assumed, never treated as absent).
--      true  = confirmed there.
--      false = confirmed NOT there (a volunteer visit staff only
--              arranged; a program or delivery no staff went to).
--
-- 2. resident_summary.last_contact_at (decisions Q3 and D3): the newest
--    resident visit, volunteer visit or phone call with the resident --
--    shown beside last_visit_at (in person only), which is unchanged.
--    Food-only deliveries and family calls are not contact here.
--
-- Undo: supabase/rollback/20261103000001_staff_attendance_and_last_contact_undo.sql

alter table public.interactions
  add column if not exists lead_attended boolean;

comment on column public.interactions.lead_attended is
  'Whether the lead (staff_member_id) was physically there (Nov 3, 2026). Null = not recorded (all older entries).';

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
      and i.voided_at is null) as last_contact_at
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;

revoke all on public.resident_summary from anon;
grant select on public.resident_summary to authenticated;
