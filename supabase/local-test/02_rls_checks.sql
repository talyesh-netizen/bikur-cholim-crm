-- Behavioral checks: proves the security rules and the "move a
-- resident" mechanism actually work, not just that the tables exist.
-- Each check prints PASS or raises a real error (which aborts the
-- script, since run.sh uses ON_ERROR_STOP=1) if something is wrong.

\set ON_ERROR_STOP on

-- ===== Check 1: an anonymous (signed-out) visitor sees no data =====
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.residents;
  if v_count = 0 then
    raise notice 'PASS (1): signed-out visitor sees 0 residents';
  else
    raise exception 'FAIL (1): signed-out visitor could see % resident row(s)', v_count;
  end if;
end $$;
reset role;

-- ===== Check 2: an active staff member can read data =====
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'noah.fischer@example.org')::text)::text,
  false
);
set role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.residents;
  if v_count > 0 then
    raise notice 'PASS (2): active staff member can read resident records (% rows)', v_count;
  else
    raise exception 'FAIL (2): active staff member could not read any residents';
  end if;
end $$;

-- ===== Check 3: staff cannot promote themselves to admin =====
do $$
declare v_update_succeeded boolean := false;
begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    v_update_succeeded := true;
  exception when others then
    v_update_succeeded := false;
  end;

  if v_update_succeeded then
    raise exception 'FAIL (3): a staff member was able to change their own role to admin';
  else
    raise notice 'PASS (3): staff member correctly blocked from self-promoting to admin';
  end if;
end $$;

-- ===== Check 4: only an admin can manage geographic clusters =====
do $$
declare v_insert_succeeded boolean := false;
begin
  begin
    insert into public.geographic_clusters (name) values ('Should Not Be Allowed');
    v_insert_succeeded := true;
  exception when others then
    v_insert_succeeded := false;
  end;

  if v_insert_succeeded then
    raise exception 'FAIL (4a): a staff member (non-admin) was able to add a geographic cluster';
  else
    raise notice 'PASS (4a): non-admin staff member correctly blocked from adding a geographic cluster';
  end if;
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'talia.green@example.org')::text)::text,
  false
);
set role authenticated;
do $$
declare v_count int;
begin
  insert into public.geographic_clusters (name) values ('Admin Test Cluster');
  select count(*) into v_count from public.geographic_clusters where name = 'Admin Test Cluster';
  if v_count = 1 then
    raise notice 'PASS (4b): admin can add a geographic cluster';
  else
    raise exception 'FAIL (4b): admin insert did not take effect as expected';
  end if;
  delete from public.geographic_clusters where name = 'Admin Test Cluster';
end $$;

-- ===== Check 5: at most one Primary Contact per resident =====
do $$
declare v_insert_succeeded boolean := false;
begin
  begin
    insert into public.resident_contacts (resident_id, contact_id, relationship_to_resident, is_primary_contact)
    values (
      (select id from public.residents where first_name = 'Ruth' and last_name = 'Abramson'),
      (select id from public.contacts where name = 'Rabbi Aaron Blumenthal'),
      'rabbi',
      true
    );
    v_insert_succeeded := true;
  exception when others then
    v_insert_succeeded := false;
  end;

  if v_insert_succeeded then
    raise exception 'FAIL (5): the database allowed a resident to have two Primary Contacts';
  else
    raise notice 'PASS (5): database correctly blocked a second Primary Contact for the same resident';
  end if;
end $$;

reset role;

-- ===== Check 6: deactivating a staff account revokes their access =====
update public.profiles set active = false where email = 'noah.fischer@example.org';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'noah.fischer@example.org')::text)::text,
  false
);
set role authenticated;
do $$
declare v_count int;
begin
  select count(*) into v_count from public.residents;
  if v_count = 0 then
    raise notice 'PASS (6): deactivated staff account immediately loses access';
  else
    raise exception 'FAIL (6): deactivated staff account could still read % resident row(s)', v_count;
  end if;
end $$;

-- Clear the simulated sign-in before this administrative cleanup step —
-- a real direct database/service-role connection (which is what's
-- required to run this next statement in production) never has a
-- request.jwt.claims value set in the first place; that GUC only gets
-- set by PostgREST on a per-request basis for real signed-in users.
reset role;
select set_config('request.jwt.claims', '', false);
update public.profiles set active = true where email = 'noah.fischer@example.org';

-- ===== Check 7: the resident transfer recorded correct history =====
do $$
declare
  v_resident_id uuid;
  v_row_count int;
  v_open_facility_name text;
begin
  select id into v_resident_id from public.residents where first_name = 'Herman' and last_name = 'Rosen';

  select count(*) into v_row_count
    from public.resident_facility_history
    where resident_id = v_resident_id;

  select f.name into v_open_facility_name
    from public.resident_facility_history h
    join public.facilities f on f.id = h.facility_id
    where h.resident_id = v_resident_id and h.end_date is null;

  if v_row_count = 2 and v_open_facility_name = 'Parkview Rehabilitation Center' then
    raise notice 'PASS (7): Herman Rosen has a 2-stay facility history and is currently open at Parkview';
  else
    raise exception 'FAIL (7): expected 2 history rows ending at Parkview, got % row(s), currently open at %', v_row_count, v_open_facility_name;
  end if;
end $$;

-- ===== Check 8: computed "last visit" views return sensible values =====
do $$
declare
  v_last_visit timestamptz;
begin
  select last_visit_at into v_last_visit
    from public.facility_summary
    where name = 'Maple Grove Rehabilitation and Nursing Center';

  if v_last_visit = '2026-07-10 09:30'::timestamptz then
    raise notice 'PASS (8): facility_summary computes the correct last visit date from the interaction log';
  else
    raise exception 'FAIL (8): expected last visit 2026-07-10 09:30, got %', v_last_visit;
  end if;
end $$;

\echo 'All checks passed.'
