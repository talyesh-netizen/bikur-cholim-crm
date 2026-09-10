-- Run through an administrative SQL connection. Every fixture is rolled back.
-- This test never creates or activates a login or changes account privileges.
begin;

insert into public.facilities (name, facility_type)
values ('CRM access test fixture', 'other');
insert into public.residents (first_name, last_name, current_facility_id)
select 'Fictional', 'Access Test', id from public.facilities
where name = 'CRM access test fixture';

set local role anon;
do $$
declare relation_name text;
begin
  foreach relation_name in array array['facilities','residents','facility_summary','resident_summary'] loop
    begin
      execute format('select * from public.%I limit 1', relation_name);
      raise exception 'Anonymous access was unexpectedly allowed: %', relation_name;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare relation_name text; visible_count bigint;
begin
  foreach relation_name in array array['facilities','residents','facility_summary','resident_summary'] loop
    execute format('select count(*) from public.%I', relation_name) into visible_count;
    if visible_count <> 0 then raise exception 'Unapproved account can read %', relation_name; end if;
  end loop;
  begin
    insert into public.facilities (name, facility_type) values ('Forbidden test insert', 'other');
    raise exception 'Unapproved account can insert facilities';
  exception when insufficient_privilege then null;
  end;
  if crm_private.is_admin() or crm_private.is_active_staff() then
    raise exception 'Unapproved account passed staff authorization';
  end if;
end $$;
reset role;
select 'PASS: anonymous reads blocked; unapproved reads and writes blocked; summary views enforce access rules' as result;
rollback;
