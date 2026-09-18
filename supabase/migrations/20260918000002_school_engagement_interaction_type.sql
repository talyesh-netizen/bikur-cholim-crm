-- Adds a distinct interaction type for school partnership activity
-- (a school visit, a student volunteer program, etc.), separate from
-- the generic "program" bucket so it can be reported on independently
-- — Year Two goals explicitly include building school partnerships.

alter table public.interactions drop constraint interactions_interaction_type_check;

alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit',
    'resident_phone_call',
    'family_communication',
    'facility_staff_communication',
    'facility_discovery_visit',
    'volunteer_visit',
    'program',
    'school_engagement',
    'kosher_food_coordination',
    'hospital_related_communication',
    'referral',
    'email',
    'other'
  ));
