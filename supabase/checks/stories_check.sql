-- Checks for 20261027000002_stories.sql: who can see, add and change a
-- story, and that stories never touch activity numbers.
--
-- Safe on any database (local, practice, live): one DO block that always
-- ends with RAISE EXCEPTION, which rolls back every change it made. Every
-- result line should start with PASS. First run on the practice (TEST)
-- database, Oct 27, 2026: all PASS.
do $test$
declare
  a uuid; b uuid; adm uuid; f1 uuid; f2 uuid; r1 uuid;
  s_free uuid; s_f1 uuid; s_f2 uuid; s_res uuid; s_b uuid;
  interactions_before int; n int;
  res text[] := '{}';
begin
  -- ---------- setup (as the database owner) ----------
  select id into a from profiles where role = 'staff' and active order by id limit 1;
  select id into b from profiles where role = 'staff' and active and id <> a order by id limit 1;
  select id into adm from profiles where role = 'admin' and active order by id limit 1;
  select r.current_facility_id, r.id into f1, r1 from residents r where r.current_facility_id is not null order by r.id limit 1;
  select id into f2 from facilities where id <> f1 order by id limit 1;
  if a is null or b is null or adm is null or f2 is null then
    raise exception 'setup: need 2 active staff, an admin, 2 facilities and a resident';
  end if;
  select count(*) into interactions_before from interactions;
  -- A has every facility; B is limited to f1 only.
  update profiles set facility_access_scope = 'all' where id = a;
  update profiles set facility_access_scope = 'restricted' where id = b;
  delete from profile_facility_access where profile_id = b;
  insert into profile_facility_access (profile_id, facility_id) values (b, f1);

  -- ---------- staff member A ----------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  insert into stories (story, created_by) values ('No links', a) returning id into s_free;
  insert into stories (story, facility_id, created_by) values ('At f1', f1, a) returning id into s_f1;
  insert into stories (story, facility_id, created_by) values ('At f2', f2, a) returning id into s_f2;
  insert into stories (story, resident_id, facility_id, created_by) values ('Resident at f1', r1, f1, a) returning id into s_res;
  res := array_append(res, 'PASS S1 staff save stories with no links, a facility, or a resident and facility');
  update stories set resident_id = r1, facility_id = f1 where id = s_free;
  get diagnostics n = row_count;
  res := array_append(res, (case when n = 1 then 'PASS S2 a story can be linked later' else 'FAIL S2' end)::text);
  update stories set resident_id = null, facility_id = null, story = 'No links (edited)' where id = s_free;
  get diagnostics n = row_count;
  res := array_append(res, (case when n = 1 then 'PASS S3 a story can be edited and unlinked' else 'FAIL S3' end)::text);
  begin
    insert into stories (story, created_by) values ('as someone else', b);
    res := array_append(res, 'FAIL S4 wrote a story as someone else');
  exception when others then res := array_append(res, 'PASS S4 no one can write a story as someone else');
  end;
  begin
    update stories set created_by = b where id = s_f1;
    res := array_append(res, 'FAIL S5 changed who wrote it');
  exception when others then res := array_append(res, 'PASS S5 who wrote a story can''t be changed');
  end;
  begin
    update stories set created_at = now() - interval '1 year' where id = s_f1;
    res := array_append(res, 'FAIL S6 changed the date');
  exception when others then res := array_append(res, 'PASS S6 a story''s date can''t be changed');
  end;
  begin
    delete from stories where id = s_f1;
    get diagnostics n = row_count;
    res := array_append(res, (case when n = 0 then 'PASS S7 a story can''t be deleted' else 'FAIL S7 deleted' end)::text);
  exception when others then res := array_append(res, 'PASS S7 a story can''t be deleted');
  end;
  begin
    insert into stories (story, created_by) values ('   ', a);
    res := array_append(res, 'FAIL S8 a blank story was saved');
  exception when others then res := array_append(res, 'PASS S8 a blank story is refused');
  end;
  reset role;

  -- ---------- staff member B, limited to f1 ----------
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from stories where id in (s_f1, s_res);
  res := array_append(res, (case when n = 2 then 'PASS L1 limited: sees stories at their facility and about its residents' else 'FAIL L1 ' || n end)::text);
  select count(*) into n from stories where id = s_f2;
  res := array_append(res, (case when n = 0 then 'PASS L2 limited: doesn''t see a story at another facility' else 'FAIL L2' end)::text);
  select count(*) into n from stories where id = s_free;
  res := array_append(res, (case when n = 0 then 'PASS L3 limited: doesn''t see someone else''s unlinked story' else 'FAIL L3' end)::text);
  insert into stories (story, created_by) values ('B''s own', b) returning id into s_b;
  select count(*) into n from stories where id = s_b;
  res := array_append(res, (case when n = 1 then 'PASS L4 limited: sees their own unlinked story' else 'FAIL L4' end)::text);
  begin
    insert into stories (story, facility_id, created_by) values ('at f2', f2, b);
    res := array_append(res, 'FAIL L5 linked a story to a facility they can''t see');
  exception when others then res := array_append(res, 'PASS L5 limited: can''t link a story to a facility they can''t see');
  end;
  update stories set story = 'changed' where id = s_f2;
  get diagnostics n = row_count;
  res := array_append(res, (case when n = 0 then 'PASS L6 limited: can''t edit a story at another facility' else 'FAIL L6' end)::text);
  begin
    update stories set facility_id = f2 where id = s_f1;
    res := array_append(res, 'FAIL L7 moved a story to a facility they can''t see');
  exception when others then res := array_append(res, 'PASS L7 limited: can''t move a story to a facility they can''t see');
  end;
  reset role;

  -- ---------- admin, signed out, deactivated ----------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', adm::text, true);
  set local role authenticated;
  select count(*) into n from stories where id in (s_free, s_f1, s_f2, s_res, s_b);
  res := array_append(res, (case when n = 5 then 'PASS A1 admin sees every story' else 'FAIL A1 ' || n end)::text);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    select count(*) into n from stories;
    res := array_append(res, (case when n = 0 then 'PASS A2 signed out: sees nothing' else 'FAIL A2' end)::text);
  exception when others then res := array_append(res, 'PASS A2 signed out: no access at all');
  end;
  reset role;
  update profiles set active = false where id = a;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  select count(*) into n from stories;
  res := array_append(res, (case when n = 0 then 'PASS A3 a deactivated account sees nothing' else 'FAIL A3' end)::text);
  reset role;

  -- ---------- history and reports ----------
  select count(*) into n from change_log where table_name = 'stories' and record_id = s_free;
  res := array_append(res, (case when n = 2 then 'PASS H1 every edit is in the change history' else 'FAIL H1 ' || n end)::text);
  select count(*) into n from interactions;
  res := array_append(res, (case when n = interactions_before then 'PASS H2 no activity entry was created (reports untouched)' else 'FAIL H2' end)::text);

  raise exception E'Stories checks (all rolled back):\n%', array_to_string(res, E'\n');
end
$test$;
