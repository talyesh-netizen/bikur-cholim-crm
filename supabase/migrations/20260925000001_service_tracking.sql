-- Service tracking for funder reporting.
--
-- Funders want to see the department's services beyond its own visits
-- and facility programs: food deliveries, volunteer impact, school & shul
-- programs, medical referrals and rides (both handed to other Bikur
-- Cholim departments -- counted, not tracked further), and care
-- navigation (helping a family find a facility or arrange care).
--
-- This adds the missing activity types plus a handful of optional
-- numbers that only apply to some of them, so the impact report can say
-- "48 Shabbos deliveries reaching ~900 seniors" instead of just "48".
-- Specific items (challah, kugel...) deliberately stay in the notes.

-- 1. New activity types. school_engagement keeps its stored value (so
-- nothing already logged has to change) but is relabeled "School & shul
-- program" in the app, with program_partner saying which.
alter table public.interactions drop constraint interactions_interaction_type_check;

alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'resident_visit',
    'resident_phone_call',
    'family_communication',
    'care_navigation',
    'facility_staff_communication',
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

-- 2. Optional service details. All nullable: most activity types use
-- none of these, and nothing logged before today has them.
alter table public.interactions
  add column occasion text check (occasion in ('regular', 'shabbos', 'yom_tov', 'other')),
  add column program_partner text check (program_partner in ('school', 'shul')),
  add column quantity integer check (quantity >= 0),
  add column people_reached integer check (people_reached >= 0),
  add column participants integer check (participants >= 0),
  add column minutes_spent integer check (minutes_spent >= 0),
  add column unmet_need boolean not null default false,
  add column unmet_need_reason text check (unmet_need_reason in (
    'no_volunteer', 'not_enough_supplies', 'no_staff_time', 'outside_our_area', 'other'
  )),
  add column funder_story boolean not null default false,
  add column service_reviewed_at timestamptz;

comment on column public.interactions.occasion is
  'Shabbos / Yom Tov / regular -- lets reports say e.g. "our Pesach deliveries reached 280 seniors".';
comment on column public.interactions.program_partner is
  'For school_engagement ("School & shul program"): whether the partner was a school or a shul.';
comment on column public.interactions.quantity is
  'How many items were delivered (challahs, meals, packages). What the items were goes in notes.';
comment on column public.interactions.people_reached is
  'Roughly how many residents a group activity reached (a delivery to a whole floor, a program).';
comment on column public.interactions.participants is
  'For school & shul programs: how many students / shul members took part.';
comment on column public.interactions.minutes_spent is
  'Time spent, in minutes. Summed into staff and volunteer hours on the impact report.';
comment on column public.interactions.unmet_need is
  'A request we could not fully meet -- the evidence for why more funding is needed.';
comment on column public.interactions.funder_story is
  'Flags an entry whose notes are worth sharing (with names removed) in a funder report.';
comment on column public.interactions.service_reviewed_at is
  'When someone last confirmed this entry''s type/details, via the "Review past entries" screen or by saving the edit form. Lets that screen show only what is left to review.';

-- Every school_engagement logged so far was a school (shuls had no type
-- of their own until now).
update public.interactions set program_partner = 'school' where interaction_type = 'school_engagement';

-- Anything logged from here on is entered with the new fields in front
-- of the person logging it, so only older rows need reviewing.
alter table public.interactions alter column service_reviewed_at set default now();

create index interactions_unreviewed_idx on public.interactions (occurred_at desc)
  where service_reviewed_at is null;
