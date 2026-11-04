-- UNDO for 20261103000002_outings_appreciation_school_roles.sql.
--
-- Use only together with putting the earlier code back live (Vercel
-- Instant Rollback); the newer code reads these fields.
--
-- What is LOST: outing links, chaperone counts and
-- volunteer roles entered since the change, and any Staff appreciation
-- entries (the type check below refuses to run while one exists -- void
-- or retype them first). Check first:
--   select count(*) filter (where outing_id is not null) outings,
----          count(*) filter (where chaperone_count is not null) chaperones,
--          count(*) filter (where interaction_type = 'staff_appreciation') appreciation
--     from public.interactions;
--   select count(*) from public.contacts where volunteer_role is not null;

alter table public.interactions drop constraint interactions_interaction_type_check;
alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit', 'resident_phone_call', 'family_communication', 'care_navigation',
    'facility_staff_communication', 'facility_visit', 'facility_discovery_visit',
    'volunteer_visit', 'volunteer_meeting', 'program', 'school_engagement', 'food_delivery',
    'kosher_food_coordination', 'hospital_related_communication', 'medical_referral',
    'ride_arranged', 'referral', 'email', 'other'
  ));

drop index if exists public.interactions_outing_id_idx;
alter table public.interactions
  drop column if exists outing_id,
  drop column if exists chaperone_count;
alter table public.contacts drop column if exists volunteer_role;
