-- "Volunteer meeting": staff meeting with a volunteer -- recruiting,
-- onboarding or a check-in. The old tracking sheet kept these on a
-- separate "Volunteer Interactions" tab because a volunteer could only
-- be recorded as the one doing a visit. The director approved a type of
-- its own (Oct 7, 2026); the volunteer is the interaction's contact and
-- the facility is optional (many meetings aren't at one).

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
