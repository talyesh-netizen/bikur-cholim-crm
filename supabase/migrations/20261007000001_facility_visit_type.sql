-- "Facility visit": the old tracking sheet's "Facility Visit" rows (I was
-- at this facility that day). They were imported as "other", which made
-- "Other" one of the biggest report categories. The director decided
-- (Oct 6, 2026) they count as real work: they get their own type and
-- sit with facility & staff work in reports.

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
    'volunteer_visit',
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

update public.interactions
set interaction_type = 'facility_visit'
where interaction_type = 'other'
  and notes ~ '^Facility Visit';
