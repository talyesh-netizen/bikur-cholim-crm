-- Launch hardening (September 2026, before real day-to-day use).
--
-- Plain-English summary:
--
-- 1. Contacts now follow facility access too. Before this, every active
--    staff member could read and edit every contact -- including the
--    family contacts of residents at facilities a "restricted" account is
--    not allowed to see. Now a contact is visible to a restricted account
--    only if it is linked to a resident or facility they CAN see, or it
--    isn't linked to any resident/facility at all (volunteers, community
--    partners). Accounts with "all facilities" access -- every account
--    today -- see exactly what they saw before.
--
-- 2. Only accounts with "all facilities" access can add a new facility.
--    A restricted account adding a facility would immediately lose sight
--    of it (it isn't on their list), which is confusing at best.
--
-- 3. Facility-history dates use Cleveland's calendar day, not the
--    database server's (UTC). A resident moved at 9pm Eastern was being
--    recorded as moving "tomorrow".
--
-- 4. A new set_interaction_volunteers() function saves the "Volunteers
--    involved" checklist for a visit as one all-or-nothing step. The app
--    used to delete the old list and then insert the new one as two
--    separate requests -- if the second failed, the visit silently lost
--    its volunteers.
--
-- 5. Defense in depth: the access-check helper functions are no longer
--    executable by the signed-out (anon) role. They were already
--    unreachable (anon has no access to the crm_private schema), but the
--    grant itself now says so.
--
-- 6. Records in this repo a setting the live database already has:
--    facility_summary runs with the viewer's own permissions
--    (security_invoker), so it can never show a restricted account a
--    facility it isn't allowed to see. It was set directly on the live
--    project but missing from these files, so a database rebuilt from
--    them would have leaked every facility to restricted accounts.
--
-- Nothing here deletes or rewrites any existing record.

-- ---------------------------------------------------------------------
-- 1 & 2. Facility-scoped contacts, and who may add facilities
-- ---------------------------------------------------------------------

create or replace function crm_private.has_all_facility_access()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select crm_private.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.facility_access_scope <> 'restricted'
    );
$$;

comment on function crm_private.has_all_facility_access() is
  'True for admins and for active staff whose facility_access_scope is ''all''. Used where a restricted account must not act beyond its facility list.';

create or replace function crm_private.can_access_contact(target_contact_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select crm_private.has_all_facility_access()
    -- Not tied to any resident or facility (volunteers, community
    -- partners, a brand-new contact not linked yet): org-wide.
    or (
      not exists (select 1 from public.resident_contacts rc where rc.contact_id = target_contact_id)
      and not exists (select 1 from public.facility_contacts fc where fc.contact_id = target_contact_id)
    )
    -- Linked to at least one resident or facility this account can see.
    or exists (
      select 1 from public.resident_contacts rc
      where rc.contact_id = target_contact_id and crm_private.can_access_resident(rc.resident_id)
    )
    or exists (
      select 1 from public.facility_contacts fc
      where fc.contact_id = target_contact_id and crm_private.can_access_facility(fc.facility_id)
    );
$$;

comment on function crm_private.can_access_contact(uuid) is
  'Whether the signed-in account may see a contact: always for all-facility accounts; for restricted accounts, only contacts that are unlinked (org-wide) or linked to a resident/facility they can access.';

drop policy if exists "contacts are readable by active staff" on public.contacts;
create policy "contacts are readable by active staff"
  on public.contacts for select to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_contact(id));

drop policy if exists "active staff can update contacts" on public.contacts;
create policy "active staff can update contacts"
  on public.contacts for update to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_contact(id))
  with check (crm_private.is_active_staff() and crm_private.can_access_contact(id));

drop policy if exists "active staff can add facilities" on public.facilities;
create policy "active staff can add facilities"
  on public.facilities for insert to authenticated
  with check (crm_private.is_active_staff() and crm_private.has_all_facility_access());

-- ---------------------------------------------------------------------
-- 3. Facility history uses the organization's calendar day
-- ---------------------------------------------------------------------

create or replace function crm_private.create_initial_facility_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.resident_facility_history (resident_id, facility_id, start_date, created_by)
  values (new.id, new.current_facility_id, (now() at time zone 'America/New_York')::date, new.created_by);
  return new;
end;
$$;

create or replace function crm_private.record_facility_transfer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if new.current_facility_id is distinct from old.current_facility_id then
    update public.resident_facility_history
      set end_date = v_today
      where resident_id = new.id and end_date is null;

    insert into public.resident_facility_history (resident_id, facility_id, start_date)
      values (new.id, new.current_facility_id, v_today);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Save a visit's volunteers atomically
-- ---------------------------------------------------------------------

-- SECURITY INVOKER (the default): runs with the caller's own row-level
-- security, so it can only touch volunteers on interactions the caller
-- is already allowed to edit. Being a single function call, the delete
-- and insert commit or roll back together.
create or replace function public.set_interaction_volunteers(
  p_interaction_id uuid,
  p_contact_ids uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.interactions where id = p_interaction_id) then
    raise exception 'Interaction not found, or you do not have access to it.';
  end if;

  delete from public.interaction_volunteers where interaction_id = p_interaction_id;

  insert into public.interaction_volunteers (interaction_id, contact_id)
  select p_interaction_id, c
  from (select distinct unnest(coalesce(p_contact_ids, '{}'::uuid[])) as c) ids;
end;
$$;

comment on function public.set_interaction_volunteers(uuid, uuid[]) is
  'Replaces the volunteers tagged on an interaction in one all-or-nothing step. Runs with the caller''s row-level security.';

revoke all on function public.set_interaction_volunteers(uuid, uuid[]) from public, anon;
grant execute on function public.set_interaction_volunteers(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Access-check helpers: signed-in staff only
-- ---------------------------------------------------------------------

revoke all on function crm_private.can_access_facility(uuid) from public, anon;
revoke all on function crm_private.can_access_resident(uuid) from public, anon;
revoke all on function crm_private.can_access_contact(uuid) from public, anon;
revoke all on function crm_private.has_all_facility_access() from public, anon;
grant execute on function crm_private.can_access_facility(uuid) to authenticated;
grant execute on function crm_private.can_access_resident(uuid) to authenticated;
grant execute on function crm_private.can_access_contact(uuid) to authenticated;
grant execute on function crm_private.has_all_facility_access() to authenticated;

-- ---------------------------------------------------------------------
-- 6. facility_summary must respect the viewer's row-level security
-- ---------------------------------------------------------------------

alter view public.facility_summary set (security_invoker = true);
alter view public.resident_summary set (security_invoker = true);
