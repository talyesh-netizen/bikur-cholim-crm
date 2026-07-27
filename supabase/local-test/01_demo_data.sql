-- Fictional demonstration data ONLY. No real residents, families, staff,
-- or facilities appear anywhere in this file — every name below is
-- invented for testing purposes.
--
-- Runs as the postgres superuser (the migration owner), which bypasses
-- row-level security, the same way Supabase's own seed process runs
-- with elevated privileges. Regular app users never get this kind of
-- unrestricted access — see the RLS checks file for proof of that.

-- ---------------------------------------------------------------------
-- Staff accounts (fictional). Inserting into auth.users fires the
-- handle_new_user trigger, which creates the matching profiles row
-- automatically.
-- ---------------------------------------------------------------------
insert into auth.users (email, raw_user_meta_data) values
  ('talia.green@example.org', '{"full_name":"Talia Green"}'),
  ('noah.fischer@example.org', '{"full_name":"Noah Fischer"}'),
  ('dina.katz@example.org', '{"full_name":"Dina Katz"}');

update public.profiles set role = 'admin' where email = 'talia.green@example.org';

-- ---------------------------------------------------------------------
-- Geographic clusters
-- ---------------------------------------------------------------------
insert into public.geographic_clusters (name, description, display_order) values
  ('East Side', 'Facilities on Cleveland''s east side', 1),
  ('Heights Area', 'Cleveland Heights, University Heights, Beachwood', 2),
  ('West Side', 'Cleveland''s west side and Lakewood', 3),
  ('Akron Area', 'Akron and surrounding suburbs', 4);

-- ---------------------------------------------------------------------
-- Facilities (fictional names — not real Northeast Ohio facilities)
-- ---------------------------------------------------------------------
insert into public.facilities (
  name, facility_type, address, city, zip, main_phone, geographic_cluster_id,
  approx_jewish_resident_count, jewish_residents_currently_known,
  engagement_status, visit_priority, recommended_visit_frequency,
  kosher_food_availability, notes, created_by
) values
  (
    'Maple Grove Rehabilitation and Nursing Center', 'nursing_home',
    '4400 Maple Grove Rd', 'Cleveland', '44121', '(216) 555-0110',
    (select id from public.geographic_clusters where name = 'East Side'),
    8, true, 'recurring_visits', 'high', 'Weekly', 'some_options',
    'Long-standing relationship with the activities department.',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Cedarbrook Assisted Living', 'assisted_living',
    '2210 Cedarbrook Ave', 'Cleveland Heights', '44118', '(216) 555-0182',
    (select id from public.geographic_clusters where name = 'Heights Area'),
    5, true, 'active_facility', 'high', 'Weekly', 'yes',
    'Hosts a monthly Shabbat program in the community room.',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Silver Birch Memory Care', 'memory_care',
    '1560 Birch Hollow Dr', 'Lakewood', '44107', '(216) 555-0143',
    (select id from public.geographic_clusters where name = 'West Side'),
    2, true, 'initial_contact', 'medium', 'Monthly', 'unknown',
    'New contact as of this summer; still building the relationship with staff.',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Riverside Senior Apartments', 'senior_apartment',
    '875 Riverside Pkwy', 'Akron', '44313', '(330) 555-0199',
    (select id from public.geographic_clusters where name = 'Akron Area'),
    3, true, 'follow_up_needed', 'medium', 'Monthly', 'no',
    'Independent apartments; residents coordinate their own kosher food.',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Hillcrest Independent Living', 'independent_living',
    '30500 Hillcrest Blvd', 'Beachwood', '44122', '(216) 555-0176', null,
    0, false, 'no_known_jewish_residents', 'low', null, 'unknown',
    'No known Jewish residents at last contact; revisit periodically.',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Parkview Rehabilitation Center', 'rehabilitation_center',
    '5100 Parkview Ter', 'South Euclid', '44121', '(216) 555-0128',
    (select id from public.geographic_clusters where name = 'East Side'),
    1, true, 'staff_relationship_developing', 'medium', 'Bi-weekly', 'some_options',
    'Short-term rehab facility; residents often transfer elsewhere within weeks.',
    (select id from auth.users where email = 'talia.green@example.org')
  );

-- ---------------------------------------------------------------------
-- Residents (fictional)
-- ---------------------------------------------------------------------
insert into public.residents (
  first_name, last_name, preferred_name, current_facility_id, room_number,
  rabbi_synagogue_connection, jewish_interests_background, kosher_food_needs,
  holiday_support_needs, visitation_needs, preferred_visit_frequency, status,
  created_by
) values
  (
    'Ruth', 'Abramson', 'Ruthie',
    (select id from public.facilities where name = 'Maple Grove Rehabilitation and Nursing Center'),
    '214', 'Congregation Beth Shalom (fictional)', 'Enjoys Shabbat candle lighting and Yiddish music',
    'Kosher meals from facility kitchen', 'Especially values High Holidays visits',
    'Uses a wheelchair; prefers morning visits', 'Weekly', 'active',
    (select id from auth.users where email = 'noah.fischer@example.org')
  ),
  (
    'Morris', 'Feldman', 'Moshe',
    (select id from public.facilities where name = 'Maple Grove Rehabilitation and Nursing Center'),
    '118', null, 'Former cantor; loves discussing Torah portions',
    'Strictly kosher, dairy restrictions', 'Wants to hear the shofar on Rosh Hashanah',
    'Hard of hearing; speak clearly and face him', 'Weekly', 'active',
    (select id from auth.users where email = 'noah.fischer@example.org')
  ),
  (
    'Estelle', 'Weiss', null,
    (select id from public.facilities where name = 'Cedarbrook Assisted Living'),
    '5B', 'Congregation Beth Shalom (fictional)', 'Enjoys group programs and music',
    'No specific restrictions', 'Family usually visits for holidays',
    'Mobile with a walker', 'Weekly', 'active',
    (select id from auth.users where email = 'dina.katz@example.org')
  ),
  (
    'Herman', 'Rosen', 'Hank',
    (select id from public.facilities where name = 'Cedarbrook Assisted Living'),
    '12A', null, 'Enjoys chess and current events',
    'Kosher-style, no pork or shellfish', 'None noted',
    'Recently hospitalized; check status before visiting', 'Weekly', 'temporarily_hospitalized',
    (select id from auth.users where email = 'noah.fischer@example.org')
  ),
  (
    'Ida', 'Perlman', null,
    (select id from public.facilities where name = 'Silver Birch Memory Care'),
    '7', null, 'Limited information so far; new contact',
    'Unknown', 'Unknown',
    'Memory care unit; keep visits short and calm', 'Monthly', 'active',
    (select id from auth.users where email = 'talia.green@example.org')
  ),
  (
    'Sam', 'Goldstein', null,
    (select id from public.facilities where name = 'Parkview Rehabilitation Center'),
    '302', 'Congregation Beth Shalom (fictional)', 'Recovering from hip surgery; in good spirits',
    'Kosher meals requested from facility', 'None noted',
    'Short-term rehab stay; likely to transfer or go home soon', 'Weekly', 'active',
    (select id from auth.users where email = 'dina.katz@example.org')
  );

-- ---------------------------------------------------------------------
-- Contacts (fictional)
-- ---------------------------------------------------------------------
insert into public.contacts (name, organization, contact_type, phone, email, preferred_communication_method, notes, created_by) values
  ('Rachel Abramson-Levy', null, 'family_member', '(216) 555-0201', 'rachel.levy@example.com', 'phone', 'Ruth Abramson''s daughter; primary decision-maker.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ('David Feldman', null, 'family_member', '(216) 555-0202', 'david.feldman@example.com', 'email', 'Morris Feldman''s son; lives out of state, prefers email updates.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ('Susan Weiss-Katz', null, 'family_member', '(216) 555-0203', 'susan.wk@example.com', 'phone', 'Estelle Weiss''s daughter.', (select id from auth.users where email = 'dina.katz@example.org')),
  ('Michael Rosen', null, 'family_member', '(216) 555-0204', 'michael.rosen@example.com', 'phone', 'Herman Rosen''s son.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ('Rabbi Aaron Blumenthal', 'Congregation Beth Shalom (fictional)', 'rabbi', '(216) 555-0300', 'rabbi.blumenthal@example.org', 'email', 'Visits several facilities monthly; good partner for High Holidays coordination.', (select id from auth.users where email = 'talia.green@example.org')),
  ('Jennifer Adams', 'Maple Grove Rehabilitation and Nursing Center', 'facility_staff', '(216) 555-0110', 'jadams@maplegrove.example.com', 'email', 'Activities Director; primary facility contact.', (select id from auth.users where email = 'talia.green@example.org')),
  ('Carlos Ruiz', 'Cedarbrook Assisted Living', 'facility_staff', '(216) 555-0182', 'cruiz@cedarbrook.example.com', 'phone', 'Social worker; helpful with care coordination.', (select id from auth.users where email = 'talia.green@example.org')),
  ('Sarah Cohen-Miller', null, 'volunteer', '(216) 555-0401', 'sarah.cm@example.com', 'text', 'Regularly visits Cedarbrook and helps with programs.', (select id from auth.users where email = 'dina.katz@example.org')),
  ('Ben Horowitz', null, 'volunteer', '(216) 555-0402', 'ben.horowitz@example.com', 'text', 'Available weekends; drives himself.', (select id from auth.users where email = 'dina.katz@example.org')),
  ('Lisa Turner', 'Cleveland Kosher Meals Program (fictional)', 'community_partner', '(216) 555-0500', 'lturner@ckmp.example.org', 'email', 'Coordinates kosher meal delivery for several facilities.', (select id from auth.users where email = 'talia.green@example.org'));

-- ---------------------------------------------------------------------
-- Resident <-> contact relationships
-- ---------------------------------------------------------------------
insert into public.resident_contacts (resident_id, contact_id, relationship_to_resident, is_primary_contact, relationship_notes, created_by) values
  ((select id from public.residents where first_name='Ruth' and last_name='Abramson'), (select id from public.contacts where name='Rachel Abramson-Levy'), 'daughter', true, 'Handles medical decisions.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ((select id from public.residents where first_name='Ruth' and last_name='Abramson'), (select id from public.contacts where name='Rabbi Aaron Blumenthal'), 'rabbi', false, null, (select id from auth.users where email = 'noah.fischer@example.org')),
  ((select id from public.residents where first_name='Morris' and last_name='Feldman'), (select id from public.contacts where name='David Feldman'), 'son', true, 'Prefers email; lives out of state.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ((select id from public.residents where first_name='Estelle' and last_name='Weiss'), (select id from public.contacts where name='Susan Weiss-Katz'), 'daughter', true, null, (select id from auth.users where email = 'dina.katz@example.org')),
  ((select id from public.residents where first_name='Herman' and last_name='Rosen'), (select id from public.contacts where name='Michael Rosen'), 'son', true, 'Notify immediately of any hospital status change.', (select id from auth.users where email = 'noah.fischer@example.org')),
  ((select id from public.residents where first_name='Sam' and last_name='Goldstein'), (select id from public.contacts where name='Rabbi Aaron Blumenthal'), 'rabbi', false, null, (select id from auth.users where email = 'dina.katz@example.org'));
  -- Note: Ida Perlman intentionally has no linked contacts yet, to
  -- reflect a real scenario ("family not yet identified") in the demo
  -- data.

-- ---------------------------------------------------------------------
-- Facility <-> contact relationships
-- ---------------------------------------------------------------------
insert into public.facility_contacts (facility_id, contact_id, role_at_facility, is_primary_contact, created_by) values
  ((select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'), (select id from public.contacts where name='Jennifer Adams'), 'Activities Director', true, (select id from auth.users where email = 'talia.green@example.org')),
  ((select id from public.facilities where name='Cedarbrook Assisted Living'), (select id from public.contacts where name='Carlos Ruiz'), 'Social Worker', true, (select id from auth.users where email = 'talia.green@example.org'));

-- ---------------------------------------------------------------------
-- Interactions (spread across a couple of months so "visits this
-- month" style dashboard logic has something real to compute against)
-- ---------------------------------------------------------------------
insert into public.interactions (occurred_at, interaction_type, facility_id, resident_id, contact_id, staff_member_id, notes, outcome, follow_up_needed, follow_up_date) values
  ('2026-06-05 10:00', 'facility_discovery_visit', (select id from public.facilities where name='Silver Birch Memory Care'), null, null, (select id from auth.users where email='talia.green@example.org'), 'First visit to introduce our program to the activities staff.', 'Staff open to future visits; identified two possible Jewish residents to confirm.', true, '2026-07-15'),
  ('2026-06-28 14:30', 'volunteer_visit', (select id from public.facilities where name='Parkview Rehabilitation Center'), (select id from public.residents where first_name='Sam' and last_name='Goldstein'), null, (select id from auth.users where email='dina.katz@example.org'), 'Ben visited Sam and played chess.', 'Sam was in good spirits, recovering well.', false, null),
  ('2026-07-09 11:00', 'resident_visit', (select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'), (select id from public.residents where first_name='Ruth' and last_name='Abramson'), null, (select id from auth.users where email='noah.fischer@example.org'), 'Birthday visit, brought flowers.', 'Ruth was delighted; reminisced about her wedding.', false, null),
  ('2026-07-10 09:30', 'resident_visit', (select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'), (select id from public.residents where first_name='Ruth' and last_name='Abramson'), null, (select id from auth.users where email='noah.fischer@example.org'), 'Follow-up visit, discussed upcoming holidays.', 'Enjoyed conversation about the High Holidays.', false, null),
  ('2026-07-12 13:00', 'kosher_food_coordination', (select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'), null, (select id from public.contacts where name='Lisa Turner'), (select id from auth.users where email='talia.green@example.org'), 'Confirmed delivery schedule for the month.', 'Delivery schedule confirmed through end of August.', false, null),
  ('2026-07-15 15:00', 'resident_phone_call', (select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'), (select id from public.residents where first_name='Morris' and last_name='Feldman'), null, (select id from auth.users where email='dina.katz@example.org'), 'Checked in since David couldn''t visit this week.', 'Morris in good spirits, looking forward to next visit.', false, null),
  ('2026-07-18 16:00', 'program', (select id from public.facilities where name='Cedarbrook Assisted Living'), null, null, (select id from auth.users where email='dina.katz@example.org'), 'Monthly Shabbat program with music and refreshments.', 'Well attended; 9 residents participated.', false, null),
  ('2026-07-20 10:30', 'resident_visit', (select id from public.facilities where name='Cedarbrook Assisted Living'), (select id from public.residents where first_name='Estelle' and last_name='Weiss'), null, (select id from auth.users where email='noah.fischer@example.org'), 'Estelle mentioned feeling lonely lately.', 'Recommended more frequent visits; family to be looped in.', true, '2026-08-05'),
  ('2026-07-22 12:00', 'hospital_related_communication', (select id from public.facilities where name='Cedarbrook Assisted Living'), (select id from public.residents where first_name='Herman' and last_name='Rosen'), (select id from public.contacts where name='Michael Rosen'), (select id from auth.users where email='noah.fischer@example.org'), 'Confirmed hospital transfer to Cleveland Clinic main campus.', 'Family notified; will follow up once discharged.', true, '2026-07-29');

-- ---------------------------------------------------------------------
-- Interaction volunteers (which volunteers were part of which visit)
-- ---------------------------------------------------------------------
insert into public.interaction_volunteers (interaction_id, contact_id) values
  ((select id from public.interactions where notes = 'Ben visited Sam and played chess.'), (select id from public.contacts where name='Ben Horowitz')),
  ((select id from public.interactions where notes = 'Monthly Shabbat program with music and refreshments.'), (select id from public.contacts where name='Sarah Cohen-Miller')),
  ((select id from public.interactions where notes = 'Monthly Shabbat program with music and refreshments.'), (select id from public.contacts where name='Ben Horowitz'));

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------
insert into public.tasks (title, description, due_date, priority, status, assigned_to, facility_id, resident_id, contact_id, task_category, completion_notes, created_by) values
  ('Birthday visit for Ruth Abramson', 'Bring flowers and celebrate her birthday.', '2026-07-09', 'medium', 'completed',
    (select id from auth.users where email='noah.fischer@example.org'),
    (select id from public.facilities where name='Maple Grove Rehabilitation and Nursing Center'),
    (select id from public.residents where first_name='Ruth' and last_name='Abramson'), null,
    'visit', 'Lovely visit, Ruth was delighted.', (select id from auth.users where email='noah.fischer@example.org')),
  ('Follow up with Weiss family', 'Estelle mentioned feeling lonely; loop in her daughter Susan about visit frequency.', '2026-08-05', 'medium', 'open',
    (select id from auth.users where email='noah.fischer@example.org'),
    (select id from public.facilities where name='Cedarbrook Assisted Living'),
    (select id from public.residents where first_name='Estelle' and last_name='Weiss'),
    (select id from public.contacts where name='Susan Weiss-Katz'),
    'family_follow_up', null, (select id from auth.users where email='noah.fischer@example.org')),
  ('Coordinate kosher food delivery at Riverside', 'Set up a recurring kosher meal delivery for residents who requested it.', '2026-07-30', 'medium', 'in_progress',
    (select id from auth.users where email='dina.katz@example.org'),
    (select id from public.facilities where name='Riverside Senior Apartments'),
    null, (select id from public.contacts where name='Lisa Turner'),
    'kosher_food', null, (select id from auth.users where email='talia.green@example.org')),
  ('Initial outreach call to Silver Birch administrator', 'Confirm whether the two possible Jewish residents identified in June are confirmed.', '2026-07-29', 'high', 'open',
    (select id from auth.users where email='talia.green@example.org'),
    (select id from public.facilities where name='Silver Birch Memory Care'),
    null, null,
    'facility_follow_up', null, (select id from auth.users where email='talia.green@example.org')),
  ('Plan High Holidays volunteer coverage', 'Recruit and schedule volunteers for High Holidays visits across all active facilities.', '2026-08-15', 'medium', 'open',
    (select id from auth.users where email='noah.fischer@example.org'),
    null, null, null,
    'volunteer_coordination', null, (select id from auth.users where email='talia.green@example.org')),
  ('Hospital follow-up for Herman Rosen', 'Check on discharge status and coordinate return to Cedarbrook or a rehab facility.', '2026-07-29', 'high', 'waiting',
    (select id from auth.users where email='noah.fischer@example.org'),
    (select id from public.facilities where name='Cedarbrook Assisted Living'),
    (select id from public.residents where first_name='Herman' and last_name='Rosen'), null,
    'hospital_follow_up', null, (select id from auth.users where email='noah.fischer@example.org'));

-- ---------------------------------------------------------------------
-- Exercise the resident transfer workflow with a realistic scenario:
-- Herman Rosen is discharged from the hospital directly to a rehab
-- facility (Parkview) rather than back to Cedarbrook right away.
-- This proves transfer_resident() and its trigger work end to end.
-- ---------------------------------------------------------------------
-- transfer_resident() reads auth.uid() to know which staff member is
-- performing the move (used as the interaction's staff_member_id). In
-- the real app this comes from the signed-in session automatically; here
-- we simulate "signed in as Noah Fischer" for this one call.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'noah.fischer@example.org')::text)::text,
  false
);

select public.transfer_resident(
  (select id from public.residents where first_name='Herman' and last_name='Rosen'),
  (select id from public.facilities where name='Parkview Rehabilitation Center'),
  'Discharged from hospital; short-term rehab stay before returning to Cedarbrook.',
  'Family notified of the transfer.'
);

update public.residents set status = 'active' where first_name='Herman' and last_name='Rosen';
