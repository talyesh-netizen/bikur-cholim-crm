-- Restricted-facility access check (read-only in effect).
--
-- Run this in the Supabase SQL editor (or via the Supabase MCP
-- execute_sql tool) against the real project any time the row-level
-- security rules change. It creates a temporary "restricted" staff
-- account that may see only ONE facility, then tries to read, create,
-- edit, move and re-link records at a DIFFERENT facility.
--
-- It is safe to run against production: the whole thing is one DO block
-- that always finishes with RAISE EXCEPTION, which rolls back every
-- change it made (the temporary account, its access grant, and any
-- attempted writes). The results come back as the text of that
-- "error" -- look for any line marked BAD / FAILED, or a count that
-- doesn't match its "(want ...)".
--
-- Last run 2026-09-25: all checks passed.
do $test$
declare
  uid uuid := gen_random_uuid();
  staff_all uuid;
  fa uuid; fb uuid; ra uuid; rb uuid; ib uuid; cb uuid; cfam uuid; ia uuid;
  n int; n2 int;
  res text[] := '{}';
begin
  -- ---------- setup (as postgres) ----------
  select r.current_facility_id into fb from residents r
   where exists (select 1 from resident_contacts rc where rc.resident_id = r.id)
     and exists (select 1 from facility_contacts fc where fc.facility_id = r.current_facility_id)
     and exists (select 1 from interactions i where i.facility_id = r.current_facility_id)
   group by r.current_facility_id order by count(*) desc limit 1;
  select r.current_facility_id into fa from residents r where r.current_facility_id <> fb
   group by 1 order by count(*) desc limit 1;
  select id into ra from residents where current_facility_id = fa limit 1;
  select id into rb from residents r where current_facility_id = fb
     and exists (select 1 from resident_contacts rc where rc.resident_id = r.id) limit 1;
  select id into ib from interactions where facility_id = fb limit 1;
  select id into ia from interactions where facility_id = fa and (resident_id is null or resident_id = ra) limit 1;
  select c.id into cb from contacts c
   where exists (select 1 from facility_contacts fc where fc.contact_id = c.id and fc.facility_id = fb)
     and not exists (select 1 from facility_contacts fc where fc.contact_id = c.id and fc.facility_id <> fb)
     and not exists (select 1 from resident_contacts rc where rc.contact_id = c.id) limit 1;
  select c.id into cfam from contacts c
   where exists (select 1 from resident_contacts rc where rc.contact_id = c.id and rc.resident_id = rb)
     and not exists (select 1 from resident_contacts rc join residents r on r.id = rc.resident_id
                     where rc.contact_id = c.id and r.current_facility_id <> fb)
     and not exists (select 1 from facility_contacts fc where fc.contact_id = c.id and fc.facility_id <> fb) limit 1;
  select id into staff_all from profiles where role = 'staff' and active and facility_access_scope = 'all' limit 1;

  res := res || format('SETUP fa=%s fb=%s ra=%s rb=%s ib=%s ia=%s cb=%s cfam=%s',
    fa is not null, fb is not null, ra is not null, rb is not null, ib is not null, ia is not null, cb is not null, cfam is not null);

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'rls-test-' || uid || '@example.invalid', '{"full_name":"RLS Test"}', now(), now());
  update profiles set active = true, role = 'staff', facility_access_scope = 'restricted' where id = uid;
  insert into profile_facility_access (profile_id, facility_id) values (uid, fa);

  -- ---------- become the restricted staff member ----------
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;

  -- ===== READS (direct table/view queries = what search, dashboard, exports, URLs all go through) =====
  select count(*) into n from facilities; select count(*) into n2 from facilities where id = fa;
  res := res || format('R01 facilities visible=%s (want 1), allowed one visible=%s (want 1)', n, n2);
  select count(*) into n from facilities where id = fb;                         res := res || format('R02 forbidden facility by id=%s (want 0)', n);
  select count(*) into n from facility_summary where id <> fa;                  res := res || format('R03 facility_summary view outside A=%s (want 0)', n);
  select count(*) into n from residents where current_facility_id <> fa;        res := res || format('R04 residents outside A=%s (want 0)', n);
  select count(*) into n from residents where id = ra;                          res := res || format('R05 allowed resident visible=%s (want 1)', n);
  select count(*) into n from residents where id = rb;                          res := res || format('R06 forbidden resident by id=%s (want 0)', n);
  select count(*) into n from resident_summary where current_facility_id <> fa; res := res || format('R07 resident_summary view outside A=%s (want 0)', n);
  select count(*) into n from resident_facility_history where resident_id = rb; res := res || format('R08 history of forbidden resident=%s (want 0)', n);
  select count(*) into n from interactions where facility_id = fb or resident_id = rb; res := res || format('R09 interactions at B/for B resident=%s (want 0)', n);
  select count(*) into n from interactions where facility_id is not null and facility_id <> fa; res := res || format('R10 any interaction at a non-A facility=%s (want 0)', n);
  select count(*) into n from interaction_volunteers where interaction_id = ib; res := res || format('R11 volunteers on B interaction=%s (want 0)', n);
  select count(*) into n from resident_contacts where resident_id = rb;         res := res || format('R12 resident_contacts of B resident=%s (want 0)', n);
  select count(*) into n from facility_contacts where facility_id = fb;         res := res || format('R13 facility_contacts at B=%s (want 0)', n);
  select count(*) into n from contacts where id = cb;                           res := res || format('R14 facility-staff contact only at B=%s (want 0)', n);
  select count(*) into n from contacts where id = cfam;                         res := res || format('R15 family contact only of B resident=%s (want 0)', n);
  select count(*) into n from contacts where contact_type = 'volunteer';        res := res || format('R16 volunteers still visible=%s (want 15)', n);
  select count(*) into n from tasks where facility_id = fb or resident_id = rb; res := res || format('R17 tasks at B=%s (want 0)', n);
  select count(*) into n from residents where (first_name || ' ' || last_name) ilike '%a%' and current_facility_id <> fa;
  res := res || format('R18 name search leaking non-A residents=%s (want 0)', n);

  -- ===== WRITES (each in its own sub-transaction) =====
  begin insert into residents (first_name, last_name, current_facility_id, status) values ('X', 'Y', fb, 'active');
    res := res || 'W01 add resident at B: ALLOWED (BAD)'; exception when others then res := res || ('W01 add resident at B: blocked (' || sqlstate || ')'); end;
  begin insert into interactions (interaction_type, facility_id, staff_member_id) values ('resident_visit', fb, uid);
    res := res || 'W02 log interaction at B: ALLOWED (BAD)'; exception when others then res := res || ('W02 log interaction at B: blocked (' || sqlstate || ')'); end;
  begin insert into interactions (interaction_type, facility_id, resident_id, staff_member_id) values ('resident_visit', fa, rb, uid);
    res := res || 'W03 interaction at A for B resident: ALLOWED (BAD)'; exception when others then res := res || ('W03 interaction at A for B resident: blocked (' || sqlstate || ')'); end;
  begin update facilities set notes = notes where id = fb; get diagnostics n = row_count;
    res := res || format('W04 edit facility B rows=%s (want 0)', n); exception when others then res := res || ('W04 edit facility B: blocked (' || sqlstate || ')'); end;
  begin update residents set room_number = room_number where id = rb; get diagnostics n = row_count;
    res := res || format('W05 edit B resident rows=%s (want 0)', n); exception when others then res := res || ('W05 edit B resident: blocked (' || sqlstate || ')'); end;
  begin update residents set current_facility_id = fb where id = ra;
    res := res || 'W06 move A resident into B by direct update: ALLOWED (BAD)'; exception when others then res := res || ('W06 move A resident into B by update: blocked (' || sqlstate || ')'); end;
  begin perform transfer_resident(ra, fb, null, null);
    res := res || 'W07 transfer_resident A->B: ALLOWED (BAD)'; exception when others then res := res || ('W07 transfer_resident A->B: blocked (' || sqlstate || ')'); end;
  begin perform transfer_resident(rb, fa, null, null);
    res := res || 'W08 transfer_resident B->A (pull out of B): ALLOWED (BAD)'; exception when others then res := res || ('W08 transfer_resident B->A: blocked (' || sqlstate || ')'); end;
  begin insert into facility_contacts (facility_id, contact_id) select fb, id from contacts where contact_type = 'volunteer' limit 1;
    res := res || 'W09 link contact to facility B: ALLOWED (BAD)'; exception when others then res := res || ('W09 link contact to facility B: blocked (' || sqlstate || ')'); end;
  begin insert into resident_contacts (resident_id, contact_id, relationship_to_resident) select rb, id, 'other' from contacts where contact_type = 'volunteer' limit 1;
    res := res || 'W10 link contact to B resident: ALLOWED (BAD)'; exception when others then res := res || ('W10 link contact to B resident: blocked (' || sqlstate || ')'); end;
  begin insert into facilities (name, facility_type) values ('RLS test facility', 'assisted_living');
    res := res || 'W11 restricted user adds facility: ALLOWED (BAD)'; exception when others then res := res || ('W11 restricted user adds facility: blocked (' || sqlstate || ')'); end;
  begin update contacts set notes = notes where id in (cb, cfam); get diagnostics n = row_count;
    res := res || format('W12 edit B-only contacts rows=%s (want 0)', n); exception when others then res := res || ('W12 edit B-only contacts: blocked (' || sqlstate || ')'); end;
  begin perform set_interaction_volunteers(ib, '{}');
    res := res || 'W13 set volunteers on B interaction: ALLOWED (BAD)'; exception when others then res := res || ('W13 set volunteers on B interaction: blocked (' || sqlstate || ')'); end;
  begin insert into tasks (title, task_category, facility_id, created_by) values ('x', 'visit', fb, uid);
    res := res || 'W14 task at B: ALLOWED (BAD)'; exception when others then res := res || ('W14 task at B: blocked (' || sqlstate || ')'); end;
  begin update interactions set facility_id = fb where id = ia; get diagnostics n = row_count;
    res := res || format('W15 move A interaction to B rows=%s (want 0 or blocked)', n); exception when others then res := res || ('W15 move A interaction to B: blocked (' || sqlstate || ')'); end;
  begin insert into profile_facility_access (profile_id, facility_id) values (uid, fb);
    res := res || 'W16 grant self access to B: ALLOWED (BAD)'; exception when others then res := res || ('W16 grant self access to B: blocked (' || sqlstate || ')'); end;
  begin update profiles set facility_access_scope = 'all' where id = uid;
    res := res || 'W17 self-upgrade to all facilities: ALLOWED (BAD)'; exception when others then res := res || ('W17 self-upgrade to all facilities: blocked (' || sqlstate || ')'); end;
  begin delete from interaction_volunteers where interaction_id = ib; get diagnostics n = row_count;
    res := res || format('W18 delete B interaction volunteers rows=%s (want 0)', n); exception when others then res := res || ('W18 delete B volunteers: blocked (' || sqlstate || ')'); end;
  begin delete from residents where id = ra;
    res := res || 'W19 hard-delete resident: ALLOWED (BAD)'; exception when others then res := res || ('W19 hard-delete resident: blocked (' || sqlstate || ')'); end;

  -- ===== positive controls: restricted user CAN work inside facility A =====
  begin
    insert into interactions (interaction_type, facility_id, resident_id, staff_member_id) values ('resident_visit', fa, ra, uid) returning id into ia;
    perform set_interaction_volunteers(ia, array(select id from contacts where contact_type = 'volunteer' limit 2));
    select count(*) into n from interaction_volunteers where interaction_id = ia;
    res := res || format('P01 log visit at A + tag 2 volunteers: ok, tagged=%s (want 2)', n);
  exception when others then res := res || ('P01 log visit at A: FAILED (' || sqlerrm || ')'); end;
  begin
    insert into contacts (name, contact_type) values ('RLS new contact', 'family_member') returning id into cb;
    insert into resident_contacts (resident_id, contact_id, relationship_to_resident) values (ra, cb, 'other');
    select count(*) into n from contacts where id = cb;
    res := res || format('P02 add family contact for A resident: ok, visible=%s (want 1)', n);
  exception when others then res := res || ('P02 add family contact: FAILED (' || sqlerrm || ')'); end;

  -- ===== unrestricted staff control: sees everything, as before =====
  perform set_config('request.jwt.claims', json_build_object('sub', staff_all, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', staff_all::text, true);
  select count(*) into n from facilities; select count(*) into n2 from contacts;
  res := res || format('C01 all-facility staff sees facilities=%s contacts=%s (want: every facility and every contact, plus the one test contact)', n, n2);

  -- ===== signed-out (anon) =====
  set local role anon;
  begin select count(*) into n from residents; res := res || format('A01 anon residents=%s (BAD)', n);
  exception when others then res := res || ('A01 anon reading residents: blocked (' || sqlstate || ')'); end;
  begin perform crm_private.can_access_facility(fa); res := res || 'A02 anon calls access helper: ALLOWED';
  exception when others then res := res || ('A02 anon calling access helper: blocked (' || sqlstate || ')'); end;

  raise exception E'RLS_RESULTS (all rolled back)\n%', array_to_string(res, E'\n');
end
$test$;
