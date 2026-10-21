-- Checks for 20261021000001_reporting_batch.sql: voiding, combining,
-- "Also there" staff, "More people met", methods, partners, and who can
-- see entries with no facility.
--
-- Safe on any database (local, test, production): one DO block that
-- always ends with RAISE EXCEPTION, which rolls back every change it
-- made. Read the result text: every line should start with PASS; the
-- last line gives the totals.
do $test$
declare
  a uuid; b uuid; adm uuid;          -- two staff members and an admin
  f1 uuid; f2 uuid; r1 uuid; c1 uuid; c2 uuid; org uuid;
  e0 uuid; e1 uuid; e2 uuid; e3 uuid; e4 uuid; u_a uuid; u_b uuid; u_shared uuid; at_f2 uuid;
  t0 timestamptz := now() - interval '3 days';
  t1 timestamptz := now() - interval '1 day';
  v_text text; v_uuid uuid; v_ts timestamptz; n int;
  res text[] := '{}';
begin
  -- ---------- setup (as the database owner) ----------
  select id into a from profiles where role = 'staff' and active order by id limit 1;
  select id into b from profiles where role = 'staff' and active and id <> a order by id limit 1;
  select id into adm from profiles where role = 'admin' and active limit 1;
  select r.current_facility_id, r.id into f1, r1 from residents r where r.current_facility_id is not null limit 1;
  select id into f2 from facilities where id <> f1 limit 1;
  select id into c1 from contacts order by id limit 1;
  select id into c2 from contacts where id <> c1 order by id limit 1;
  select id into org from organizations limit 1;
  if org is null then
    insert into organizations (name, organization_type) values ('Check: sample partner', 'school') returning id into org;
  end if;
  if a is null or b is null or f1 is null or f2 is null or c2 is null or org is null then
    raise exception 'setup: need 2 active staff, 2 facilities, a resident, 2 contacts and an organization';
  end if;
  -- Everyone starts unrestricted for the setup.
  update profiles set facility_access_scope = 'all' where id in (a, b);

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
    res := array_append(res, ('FAIL V1 voided without a reason was allowed')::text);
  exception when check_violation then res := array_append(res, ('PASS V1 voiding without a reason is refused')::text);
  end;
  begin
    update interactions set voided_at = now(), void_reason = '   ' where id = e1;
    res := array_append(res, ('FAIL V2 voided with a blank reason was allowed')::text);
  exception when check_violation then res := array_append(res, ('PASS V2 voiding with a blank reason is refused')::text);
  end;

  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts >= t1 then 'PASS V3 last visit is the newer entry before voiding'
                     else 'FAIL V3 last visit before voiding = ' || coalesce(v_ts::text, 'null') end)::text);

  update interactions set voided_at = now(), void_reason = 'Duplicate', voided_by = b where id = e1;
  select voided_by into v_uuid from interactions where id = e1;
  res := array_append(res, (case when v_uuid = a then 'PASS V4 "voided by" is always the signed-in person (a sent-in name is ignored)'
                     else 'FAIL V4 voided_by = ' || coalesce(v_uuid::text, 'null') end)::text);

  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts < t1 then 'PASS V5 resident''s last visit skips the voided entry'
                     else 'FAIL V5 resident''s last visit still uses the voided entry' end)::text);
  select count(*) into n from interactions where id = e1;
  res := array_append(res, (case when n = 1 then 'PASS V6 a voided entry is still on file' else 'FAIL V6 voided entry disappeared' end)::text);

  update interactions set voided_at = null where id = e1;
  select count(*) into n from interactions where id = e1 and voided_by is null and void_reason is null;
  res := array_append(res, (case when n = 1 then 'PASS V7 restoring clears the void mark' else 'FAIL V7 restore left void details behind' end)::text);
  select last_visit_at into v_ts from resident_summary where id = r1;
  res := array_append(res, (case when v_ts >= t1 then 'PASS V8 restored entry counts again as last visit' else 'FAIL V8 restored entry not counted' end)::text);

  begin
    update interactions set method = 'fax' where id = e0;
    res := array_append(res, ('FAIL M1 an unknown method was accepted')::text);
  exception when check_violation then res := array_append(res, ('PASS M1 only in person / phone / email / video are accepted')::text);
  end;
  select count(*) into n from interactions where id = e0 and method is null;
  res := array_append(res, (case when n = 1 then 'PASS M2 an entry without a method stays "not recorded"' else 'FAIL M2 method was filled in' end)::text);

  -- Off-site program at a partner, no facility.
  insert into interactions (interaction_type, occurred_at, organization_id, staff_member_id, method)
    values ('program', t1, org, a, 'in_person') returning id into u_a;
  res := array_append(res, ('PASS P1 a program at a Strategic Partner can be saved with no facility')::text);

  -- Also there / more people met.
  update interactions set contact_id = c1 where id = e0;
  perform set_interaction_staff(e0, array[b, a]);
  select count(*) into n from interaction_staff where interaction_id = e0;
  res := array_append(res, (case when n = 1 then 'PASS S1 "Also there" stores the colleague, not the person who logged it'
                     else 'FAIL S1 also-there rows = ' || n end)::text);
  perform set_interaction_people(e0, array[c1, c2]);
  select count(*) into n from interaction_people where interaction_id = e0;
  res := array_append(res, (case when n = 1 then 'PASS S2 "More people met" stores extra people, not the main contact twice'
                     else 'FAIL S2 people rows = ' || n end)::text);
  perform set_interaction_staff(e0, '{}');
  select count(*) into n from interaction_staff where interaction_id = e0;
  res := array_append(res, (case when n = 0 then 'PASS S3 clearing "Also there" removes the colleague' else 'FAIL S3 rows left = ' || n end)::text);

  -- Combine (a Quick Log copy by B into A's entry) and undo.
  insert into interactions (interaction_type, occurred_at, facility_id, resident_id, staff_member_id)
    values ('family_communication', t1, f1, r1, a) returning id into e2;
  insert into interactions (interaction_type, occurred_at, facility_id, resident_id, staff_member_id, contact_id)
    values ('family_communication', t1, f1, r1, b, c2) returning id into e3;
  perform combine_interactions(e2, array[e3]);
  select count(*) into n from interactions where id = e3 and voided_at is not null and combined_into = e2;
  res := array_append(res, (case when n = 1 then 'PASS C1 combining voids the extra entry and points it at the kept one' else 'FAIL C1' end)::text);
  select count(*) into n from interaction_staff where interaction_id = e2 and profile_id = b and source_interaction_id = e3;
  res := array_append(res, (case when n = 1 then 'PASS C2 the colleague is credited on the kept entry' else 'FAIL C2' end)::text);
  select count(*) into n from interaction_people where interaction_id = e2 and contact_id = c2;
  res := array_append(res, (case when n = 1 then 'PASS C3 the person met moves onto the kept entry' else 'FAIL C3' end)::text);
  perform uncombine_interaction(e3);
  select count(*) into n from interactions where id = e3 and voided_at is null and combined_into is null;
  select count(*) + n into n from interaction_staff where interaction_id = e2;
  res := array_append(res, (case when n = 1 then 'PASS C4 undo restores the entry and takes back what was added' else 'FAIL C4 n=' || n end)::text);
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id)
    values ('program', t1, f1, a) returning id into e4;
  begin
    perform combine_interactions(e2, array[e4]);
    res := array_append(res, ('FAIL C5 entries of different kinds were combined')::text);
  exception when raise_exception then res := array_append(res, ('PASS C5 entries of different kinds cannot be combined')::text);
  end;

  -- Entries with no facility and no resident, for the restricted test.
  insert into interactions (interaction_type, occurred_at, staff_member_id, contact_id)
    values ('volunteer_meeting', t1, a, c1) returning id into u_shared;
  perform set_interaction_staff(u_shared, array[b]);
  insert into interactions (interaction_type, occurred_at, facility_id, staff_member_id)
    values ('facility_visit', t1, f2, a) returning id into at_f2;
  insert into interaction_duplicate_reviews (group_key, decision) values (e2::text || ',' || e3::text, 'kept_separate');
  res := array_append(res, ('PASS D1 "keep separate" answers can be recorded')::text);

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
  res := array_append(res, (case when n = 0 then 'PASS R1 restricted: someone else''s off-site entry is hidden' else 'FAIL R1 restricted user sees it' end)::text);
  select count(*) into n from interactions where id = u_shared;
  res := array_append(res, (case when n = 1 then 'PASS R2 restricted: an off-site entry they are credited on is visible' else 'FAIL R2 hidden' end)::text);
  select count(*) into n from interactions where id = at_f2;
  res := array_append(res, (case when n = 0 then 'PASS R3 restricted: an entry at another facility is still hidden' else 'FAIL R3 visible' end)::text);
  select count(*) into n from interactions where id = e0;
  res := array_append(res, (case when n = 1 then 'PASS R4 restricted: an entry at their own facility is visible' else 'FAIL R4 hidden' end)::text);
  insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, b) returning id into u_b;
  select count(*) into n from interactions where id = u_b;
  res := array_append(res, (case when n = 1 then 'PASS R5 restricted: their own off-site entry is saved and visible' else 'FAIL R5' end)::text);
  begin
    insert into interactions (interaction_type, occurred_at, staff_member_id) values ('volunteer_meeting', t1, a);
    res := array_append(res, ('FAIL R6 restricted user saved an off-site entry in someone else''s name')::text);
  exception when insufficient_privilege then res := array_append(res, ('PASS R6 restricted: cannot save an off-site entry in someone else''s name')::text);
  end;
  update interactions set notes = 'x' where id = u_a;
  get diagnostics n = row_count;
  res := array_append(res, (case when n = 0 then 'PASS R7 restricted: cannot edit someone else''s off-site entry' else 'FAIL R7 edited it' end)::text);
  begin
    perform combine_interactions(e2, array[at_f2]);
    res := array_append(res, ('FAIL R8 restricted user combined an entry they cannot see')::text);
  exception when raise_exception then res := array_append(res, ('PASS R8 restricted: cannot combine entries they cannot see')::text);
  end;

  -- ---------- A (unrestricted) still sees everything ----------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into n from interactions where id in (u_a, u_b, u_shared, at_f2);
  res := array_append(res, (case when n = 4 then 'PASS R9 unrestricted staff see every entry, as before' else 'FAIL R9 sees ' || n || ' of 4' end)::text);

  -- ---------- signed out ----------
  set local role anon;
  begin
    select count(*) into n from interaction_staff;
    res := array_append(res, (case when n = 0 then 'PASS A1 signed-out visitor sees no "Also there" rows' else 'FAIL A1 anon sees rows' end)::text);
  exception when insufficient_privilege then res := array_append(res, ('PASS A1 signed-out visitor is refused "Also there" rows')::text);
  end;

  -- ---------- audit trail (as the owner; admins-only table) ----------
  reset role;
  select count(*) into n from change_log
   where table_name = 'interactions' and record_id = e1 and changed_by = a and changes ? 'voided_at';
  res := array_append(res, (case when n >= 2 then 'PASS L1 voiding and restoring are both in the change history, with who did it'
                     else 'FAIL L1 change history entries = ' || n end)::text);

  select count(*) into n from unnest(res) x where x like 'FAIL%';
  raise exception E'REPORTING_BATCH_RESULTS (all rolled back)\n%\n== % checks, % failed ==',
    array_to_string(res, E'\n'), array_length(res, 1), n;
end
$test$;
