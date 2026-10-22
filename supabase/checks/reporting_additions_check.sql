-- Checks for 20261021000001_reporting_additions.sql: voiding, how it
-- happened (method), "Same meeting" review carrying the person, and who
-- can see entries with no facility.
--
-- Safe on any database (local, practice, live): one DO block that always
-- ends with RAISE EXCEPTION, which rolls back every change it made. Every
-- result line should start with PASS; the last line gives the totals.
do $test$
declare
  a uuid; b uuid; adm uuid;
  f1 uuid; f2 uuid; r1 uuid; c1 uuid; c2 uuid;
  e0 uuid; e1 uuid; m1 uuid; m2 uuid; m3 uuid; m4 uuid; u_a uuid; u_b uuid; u_team uuid; at_f2 uuid; old_row uuid;
  rev uuid;
  t0 timestamptz := now() - interval '3 days';
  t1 timestamptz := now() - interval '1 day';
  v_uuid uuid; v_ts timestamptz; v_text text; v_bool boolean; n int;
  res text[] := '{}';
begin
  -- ---------- setup (as the database owner) ----------
  select id into a from profiles where role = 'staff' and active order by id limit 1;
  select id into b from profiles where role = 'staff' and active and id <> a order by id limit 1;
  select id into adm from profiles where role = 'admin' and active order by id limit 1;
  select r.current_facility_id, r.id into f1, r1 from residents r where r.current_facility_id is not null order by r.id limit 1;
  select id into f2 from facilities where id <> f1 order by id limit 1;
  select id into c1 from contacts order by id limit 1;
  select id into c2 from contacts where id <> c1 order by id limit 1;
  if a is null or b is null or adm is null or f2 is null or c2 is null then
    raise exception 'setup: need 2 active staff, an admin, 2 facilities, a resident and 2 contacts';
  end if;
  update profiles set facility_access_scope = 'all' where id in (a, b);
  -- An existing entry, to prove nothing old is touched.
  select id into old_row from interactions where voided_at is null order by created_at limit 1;

  -- ---------- as staff member A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;

  insert into interactions (interaction_type, occurred_at, facility_id, resident_id, staff_member_id)
    values ('resident_visit', t0, f1, r1, a) returning id into e0;
  insert into interactions (interaction_type, occurred_at, facility_id, resident_id, staff_member_id)
    values ('resident_visit', t1, f1, r1, a) returning id into e1;

  begin
    update interactions set voided_at = now() where id = e1;
    res := array_append(res, 'FAIL V1 voided without a reason was allowed');
  exception when check_violation then res := array_append(res, 'PASS V1 voiding without a reason is refused');
  end;
  begin
    update interactions set voided_at = now(), void_reason = '   ' where id = e1;
    res := array_append(res, 'FAIL V2 voided with a blank reason was allowed');
  exception when check_violation then res := array_append(res, 'PASS V2 voiding with a blank reason is refused');
  end;
  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts >= t1 then 'PASS V3 last visit is the newer entry before voiding' else 'FAIL V3' end)::text);
  update interactions set voided_at = now(), void_reason = 'Entered twice', voided_by = b where id = e1;
  select voided_by into v_uuid from interactions where id = e1;
  res := array_append(res, (case when v_uuid = a then 'PASS V4 "voided by" is always the signed-in person' else 'FAIL V4 voided_by = ' || coalesce(v_uuid::text, 'null') end)::text);
  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts < t1 then 'PASS V5 resident''s last visit skips the voided entry' else 'FAIL V5' end)::text);
  -- (Other entries at this facility may be newer; what matters is that
  -- the voided one is no longer what's shown.)
  select last_visit_at into v_ts from facility_summary where id = f1;
  res := array_append(res, (case when v_ts is distinct from t1 then 'PASS V6 facility''s last contact skips the voided entry' else 'FAIL V6' end)::text);
  select count(*) into n from interactions where id = e1;
  res := array_append(res, (case when n = 1 then 'PASS V7 a voided entry stays on file' else 'FAIL V7' end)::text);
  update interactions set voided_at = null where id = e1;
  select count(*) into n from interactions where id = e1 and voided_by is null and void_reason is null;
  res := array_append(res, (case when n = 1 then 'PASS V8 restoring clears the void mark' else 'FAIL V8' end)::text);
  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts >= t1 then 'PASS V9 a restored entry counts again' else 'FAIL V9' end)::text);

  -- How it happened.
  begin
    update interactions set method = 'fax' where id = e0;
    res := array_append(res, 'FAIL M1 an unknown method was accepted');
  exception when check_violation then res := array_append(res, 'PASS M1 only the five ways (at facility / elsewhere / phone / email / video) are accepted');
  end;
  select method into v_text from interactions where id = e0;
  res := array_append(res, (case when v_text is null then 'PASS M2 an entry saved without a method stays "not recorded"' else 'FAIL M2' end)::text);
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id, contact_id, method)
    values ('facility_staff_communication', t1, f1, a, c1, 'phone') returning id into m1;
  select in_person into v_bool from interactions where id = m1;
  res := array_append(res, (case when v_bool is false then 'PASS M3 a phone call is never "in person"' else 'FAIL M3' end)::text);
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id, contact_id, in_person)
    values ('facility_staff_communication', t1, f1, a, c2, true) returning id into m2;
  select method into v_text from interactions where id = m2;
  res := array_append(res, (case when v_text = 'in_person' then 'PASS M4 the on-site "in person" tick records In person' else 'FAIL M4' end)::text);
  update interactions set method = 'video' where id = m2;
  select in_person into v_bool from interactions where id = m2;
  res := array_append(res, (case when v_bool is false then 'PASS M5 changing to Video clears "in person"' else 'FAIL M5' end)::text);
  update interactions set method = null where id = m2;
  select in_person into v_bool from interactions where id = m2;
  res := array_append(res, (case when v_bool is null then 'PASS M6 clearing the method makes it "not recorded" again' else 'FAIL M6' end)::text);
  -- In person elsewhere (director, Oct 21, 2026): keeps its facility, never a visit-day.
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id, method)
    values ('family_communication', t1, f1, a, 'in_person_elsewhere') returning id into m3;
  select in_person, facility_id into v_bool, v_uuid from interactions where id = m3;
  res := array_append(res, (case when v_bool is false and v_uuid = f1 then 'PASS M7 "In person elsewhere" keeps the facility and is not "at the facility"' else 'FAIL M7' end)::text);
  insert into interactions (interaction_type, occurred_at, staff_member_id, method)
    values ('program', t1, a, 'in_person') returning id into m4;
  select method, in_person into v_text, v_bool from interactions where id = m4;
  res := array_append(res, (case when v_text = 'in_person_elsewhere' and v_bool is false then 'PASS M8 "at facility" with no facility is saved as elsewhere' else 'FAIL M8 ' || coalesce(v_text, 'null') end)::text);
  update interactions set method = 'in_person', facility_id = f1 where id = m2;
  update interactions set facility_id = null where id = m2;
  select method into v_text from interactions where id = m2;
  res := array_append(res, (case when v_text = 'in_person_elsewhere' then 'PASS M9 removing the facility from an "at facility" entry makes it elsewhere' else 'FAIL M9 ' || coalesce(v_text, 'null') end)::text);
  update interactions set facility_id = f1, method = 'in_person' where id = m2;

  -- Entries with no facility and no resident.
  insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, a) returning id into u_a;
  insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, a) returning id into u_team;
  insert into interaction_team_members (interaction_id, profile_id) values (u_team, b);
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id) values ('facility_visit', t1, f2, a) returning id into at_f2;

  -- ---------- "Same meeting" review, as the admin ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', adm::text, true);
  set local role authenticated;
  -- m1 (with c1) and m2 (with c2): one meeting saved as two entries.
  perform review_double_entry(m1, m2, 'same');
  select count(*) into n from interactions where id = m2 and counted_in_id = m1;
  res := array_append(res, (case when n = 1 then 'PASS D1 "Same meeting" counts the second entry once, in the first' else 'FAIL D1' end)::text);
  select count(*) into n from interaction_contacts where interaction_id = m1 and contact_id = c2 and engaged;
  res := array_append(res, (case when n = 1 then 'PASS D2 the second person joins the kept meeting (one meeting, two people)' else 'FAIL D2' end)::text);
  select id into rev from duplicate_reviews where kept_id = m1 and other_id = m2;
  perform undo_double_entry_review(rev);
  select count(*) into n from interaction_contacts where interaction_id = m1 and contact_id = c2;
  select count(*) + n into n from interactions where id = m2 and counted_in_id is not null;
  res := array_append(res, (case when n = 0 then 'PASS D3 undo takes back exactly what the review added' else 'FAIL D3 n=' || n end)::text);
  update interactions set voided_at = now(), void_reason = 'test' where id = m2;
  begin
    perform review_double_entry(m1, m2, 'same');
    res := array_append(res, 'FAIL D4 a voided entry could be reviewed');
  exception when raise_exception then res := array_append(res, 'PASS D4 a voided entry can''t be reviewed until restored');
  end;

  -- ---------- B becomes facility-restricted to f1 only ----------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  update profiles set facility_access_scope = 'restricted' where id = b;
  insert into profile_facility_access (profile_id, facility_id) values (b, f1);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;

  select count(*) into n from interactions where id = u_a;
  res := array_append(res, (case when n = 0 then 'PASS R1 restricted: someone else''s entry with no facility is hidden' else 'FAIL R1' end)::text);
  select count(*) into n from interactions where id = u_team;
  res := array_append(res, (case when n = 1 then 'PASS R2 restricted: an entry with no facility they were a team member on is visible' else 'FAIL R2' end)::text);
  select count(*) into n from interactions where id = at_f2;
  res := array_append(res, (case when n = 0 then 'PASS R3 restricted: an entry at another facility is still hidden' else 'FAIL R3' end)::text);
  select count(*) into n from interactions where id = e0;
  res := array_append(res, (case when n = 1 then 'PASS R4 restricted: an entry at their own facility is visible' else 'FAIL R4' end)::text);
  insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, b) returning id into u_b;
  select count(*) into n from interactions where id = u_b;
  res := array_append(res, (case when n = 1 then 'PASS R5 restricted: their own entry with no facility saves and shows' else 'FAIL R5' end)::text);
  begin
    insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, a);
    res := array_append(res, 'FAIL R6 restricted user saved an entry in someone else''s name');
  exception when insufficient_privilege then res := array_append(res, 'PASS R6 restricted: can''t save an entry with no facility in someone else''s name');
  end;
  update interactions set notes = 'x' where id = u_a;
  get diagnostics n = row_count;
  res := array_append(res, (case when n = 0 then 'PASS R7 restricted: can''t edit someone else''s entry with no facility' else 'FAIL R7' end)::text);
  select count(*) into n from interaction_team_members where interaction_id = u_a;
  res := array_append(res, (case when n = 0 then 'PASS R8 restricted: can''t see who was on a hidden entry' else 'FAIL R8' end)::text);

  -- ---------- A (unrestricted) still sees everything ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into n from interactions where id in (u_a, u_b, u_team, at_f2);
  res := array_append(res, (case when n = 4 then 'PASS R9 unrestricted staff see every entry, as before' else 'FAIL R9 sees ' || n || ' of 4' end)::text);

  -- ---------- audit trail and untouched history (as the owner) ----------
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  select count(*) into n from change_log
   where table_name = 'interactions' and record_id = e1 and changed_by = a and changes ? 'voided_at';
  res := array_append(res, (case when n >= 2 then 'PASS L1 voiding and restoring are both in the change history, with who did it' else 'FAIL L1 entries = ' || n end)::text);
  if old_row is not null then
    select count(*) into n from interactions where id = old_row and voided_at is null and method is null;
    res := array_append(res, (case when n = 1 then 'PASS L2 an existing entry was left exactly as it was' else 'FAIL L2' end)::text);
  end if;

  select count(*) into n from unnest(res) x where x like 'FAIL%';
  raise exception E'REPORTING_ADDITIONS_RESULTS (all rolled back)\n%\n== % checks, % failed ==',
    array_to_string(res, E'\n'), array_length(res, 1), n;
end
$test$;
