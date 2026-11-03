-- Impact and logging fixes (director and ChatGPT, approved Nov 3, 2026).
-- Add-only: new optional fields and one new kind of entry. Nothing that
-- is already saved is changed, moved or deleted; every new field is
-- empty on existing entries, and empty means "as before".
--
-- 1. outing_id: a volunteer outing that saw several residents is saved as
--    one entry per resident (each resident's history and engagement stay
--    right), all with the same outing_id, so reports count one outing.
--    Empty on older entries: reports treat older entries with the same
--    volunteers, facility and day as one outing (they can't be told apart).
--    (Who went along is lead_attended + team members, from
--    20261103000001_staff_attendance_and_last_contact.sql.)
-- 2. chaperone_count: school staff / chaperones at a program, asked
--    separately from students and community volunteers (A3).
-- 3. contacts.volunteer_role: whether a volunteer is a community
--    volunteer, a student or school staff. Empty = community volunteer,
--    as every volunteer has been counted so far. Never assumed from a
--    school link.
-- 4. "staff_appreciation": bringing food, refreshments or gifts to a
--    facility's staff. One activity each, never a staff conversation or
--    food assistance; no recipient count.
--
-- Undo: supabase/rollback/20261103000002_outings_appreciation_school_roles_undo.sql

alter table public.interactions
  add column if not exists outing_id uuid,
  add column if not exists chaperone_count integer check (chaperone_count >= 0);

comment on column public.interactions.outing_id is
  'Volunteer visits saved together as one outing (one entry per resident) share this id; reports count one outing. Empty on older entries (reports group those by volunteers, facility and day).';
comment on column public.interactions.chaperone_count is
  'School staff / chaperones who took part in a program (Nov 3, 2026). Empty on older entries.';

create index if not exists interactions_outing_id_idx on public.interactions (outing_id) where outing_id is not null;

alter table public.contacts
  add column if not exists volunteer_role text
    check (volunteer_role in ('community', 'student', 'school_staff'));

comment on column public.contacts.volunteer_role is
  'For volunteers: community volunteer, student or school staff/chaperone. Empty = community volunteer (as counted before Nov 3, 2026).';

alter table public.interactions drop constraint interactions_interaction_type_check;

alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit',
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
