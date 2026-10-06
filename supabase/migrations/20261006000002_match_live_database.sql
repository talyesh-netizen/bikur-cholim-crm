-- Brings a database rebuilt from these migration files in line with the
-- live production database (checked object-by-object on 2026-10-06).
-- Several fixes had been applied to production directly and never saved
-- here; without this file a rebuild would lose them. Every statement is
-- idempotent and matches production exactly, so running it against the
-- live database changes nothing.

-- 1. Organizations: parent organization + outreach center type (live since 2026-10-01)
alter table public.organizations add column if not exists parent_organization_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_parent_organization_id_fkey') then
    alter table public.organizations add constraint organizations_parent_organization_id_fkey
      foreign key (parent_organization_id) references public.organizations(id);
  end if;
end $$;
create index if not exists organizations_parent_organization_id_idx on public.organizations using btree (parent_organization_id);
alter table public.organizations drop constraint if exists organizations_organization_type_check;
alter table public.organizations add constraint organizations_organization_type_check
  check (organization_type = any (array['synagogue'::text, 'school'::text, 'outreach_center'::text, 'community_partner'::text, 'other'::text]));

-- 2. Function bodies exactly as live
create or replace function crm_private.can_access_contact(target_contact_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select crm_private.has_all_facility_access()
    or (
      not exists (select 1 from public.resident_contacts rc where rc.contact_id = target_contact_id)
      and not exists (select 1 from public.facility_contacts fc where fc.contact_id = target_contact_id)
    )
    or exists (
      select 1 from public.resident_contacts rc
      where rc.contact_id = target_contact_id and crm_private.can_access_resident(rc.resident_id)
    )
    or exists (
      select 1 from public.facility_contacts fc
      where fc.contact_id = target_contact_id and crm_private.can_access_facility(fc.facility_id)
    );
$function$;

create or replace function crm_private.create_initial_facility_history()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.current_facility_id is not null then
    insert into public.resident_facility_history (resident_id, facility_id, start_date, created_by)
    values (new.id, new.current_facility_id, (now() at time zone 'America/New_York')::date, new.created_by);
  end if;
  return new;
end;
$function$;

create or replace function crm_private.record_facility_transfer()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if new.current_facility_id is distinct from old.current_facility_id then
    update public.resident_facility_history
      set end_date = v_today
      where resident_id = new.id and end_date is null;

    if new.current_facility_id is not null then
      insert into public.resident_facility_history (resident_id, facility_id, start_date)
      values (new.id, new.current_facility_id, v_today);
    end if;
  end if;
  return new;
end;
$function$;

create or replace function crm_private.log_change()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb;
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    select jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
      into v_changes
      from jsonb_each(v_new) n
      where n.key <> 'updated_at'
        and (v_old -> n.key) is distinct from n.value;
    if v_changes is null then
      return new;
    end if;
    insert into public.change_log (table_name, record_id, action, changed_by, changes)
    values (tg_table_name, new.id, 'update', auth.uid(), v_changes);
    return new;
  end if;

  insert into public.change_log (table_name, record_id, action, changed_by, changes)
  values (tg_table_name, old.id, 'delete', auth.uid(), v_old);
  return old;
end;
$function$;

create or replace function crm_private.handle_new_user()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, email, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Pending account'),
    coalesce(new.email, ''),
    false
  );
  return new;
end;
$function$;

create or replace function public.transfer_resident(p_resident_id uuid, p_new_facility_id uuid, p_reason text default null::text, p_notes text default null::text)
 returns residents language plpgsql set search_path to 'public'
as $function$
declare
  v_old_facility_id uuid;
  v_exists boolean;
  v_resident public.residents;
begin
  select true, current_facility_id
    into v_exists, v_old_facility_id
    from public.residents
    where id = p_resident_id;

  if coalesce(v_exists, false) = false then
    raise exception 'Resident not found, or you do not have access to view them.';
  end if;

  if v_old_facility_id = p_new_facility_id then
    raise exception 'That resident is already at this facility.';
  end if;

  update public.residents
    set current_facility_id = p_new_facility_id,
        status = case when status = 'location_unknown' then 'active' else status end
    where id = p_resident_id
    returning * into v_resident;

  insert into public.interactions (
    interaction_type, facility_id, resident_id, staff_member_id, notes, outcome
  ) values (
    'other',
    p_new_facility_id,
    p_resident_id,
    auth.uid(),
    coalesce(p_notes, ''),
    'Resident transferred to this facility.'
      || case when p_reason is not null then ' Reason: ' || p_reason else '' end
  );

  return v_resident;
end;
$function$;

-- Unused leftovers that still exist live (locked down; kept so the two match)
create or replace function public.create_initial_facility_history()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.current_facility_id is not null then
    insert into public.resident_facility_history (resident_id, facility_id, start_date, created_by)
    values (new.id, new.current_facility_id, current_date, new.created_by);
  end if;
  return new;
end;
$function$;

create or replace function public.record_facility_transfer()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.current_facility_id is distinct from old.current_facility_id then
    update public.resident_facility_history
      set end_date = current_date
      where resident_id = new.id and end_date is null;

    if new.current_facility_id is not null then
      insert into public.resident_facility_history (resident_id, facility_id, start_date)
      values (new.id, new.current_facility_id, current_date);
    end if;
  end if;
  return new;
end;
$function$;

-- 3. Triggers call the locked-down crm_private versions
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function crm_private.handle_new_user();
drop trigger if exists create_initial_facility_history on public.residents;
create trigger create_initial_facility_history after insert on public.residents
  for each row execute function crm_private.create_initial_facility_history();
drop trigger if exists record_facility_transfer on public.residents;
create trigger record_facility_transfer after update of current_facility_id on public.residents
  for each row execute function crm_private.record_facility_transfer();
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles
  for each row execute function crm_private.protect_profile_privileges();

alter function public.set_updated_at() set search_path = '';

-- 4. Access rules that live uses crm_private helpers for
drop policy if exists "active staff can add contacts" on public.contacts;
create policy "active staff can add contacts" on public.contacts
  for insert to authenticated with check (crm_private.is_active_staff());
drop policy if exists "clusters are readable by active staff" on public.geographic_clusters;
create policy "clusters are readable by active staff" on public.geographic_clusters
  for select to authenticated using (crm_private.is_active_staff());
drop policy if exists "profiles are readable by active staff" on public.profiles;
create policy "profiles are readable by active staff" on public.profiles
  for select to authenticated using (crm_private.is_active_staff());

-- Old public copies of the helpers no longer exist live
drop function if exists public.handle_new_user();
drop function if exists public.is_active_staff();
drop function if exists public.is_admin();
drop function if exists public.protect_profile_privileges();

-- 5. Table permissions exactly as live (row-level security still decides
--    which rows anyone sees; these decide which actions are possible at all)
do $$ declare t text; begin
  for t in select c.relname from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
             and c.relname not like 'crm_backup%' loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
grant references, select, trigger on public.change_log to anon, authenticated;
grant insert, select, update on public.contacts, public.facilities, public.geographic_clusters,
  public.interactions, public.organizations, public.residents, public.tasks to authenticated;
grant delete, insert, select, update on public.facility_contacts, public.organization_contacts,
  public.profile_facility_access, public.resident_contacts to authenticated;
grant select on public.facility_summary, public.resident_summary, public.resident_facility_history to authenticated;
grant delete, insert, select on public.interaction_volunteers to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.profile_notes to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant references, trigger on public.resident_private_notes to anon;
grant references, select, trigger on public.resident_private_notes to authenticated;

-- 6. Who may run which function, exactly as live
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, n.nspname, p.proname from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'crm_private') loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.sig);
  end loop;
end $$;
grant execute on function crm_private.can_access_contact(uuid), crm_private.can_access_facility(uuid),
  crm_private.can_access_resident(uuid), crm_private.has_all_facility_access(),
  crm_private.is_active_staff(), crm_private.is_admin() to authenticated;
grant execute on function crm_private.can_see_private_notes() to public;
grant execute on function public.create_initial_facility_history(), public.record_facility_transfer(),
  public.set_updated_at() to service_role;
grant execute on function public.set_interaction_volunteers(uuid, uuid[]),
  public.transfer_resident(uuid, uuid, text, text) to authenticated, service_role;
