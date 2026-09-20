-- facility_access_scope: lets an admin restrict a staff account to a
-- specific set of facilities, instead of every active staff member
-- automatically seeing every facility.
--
-- Plain-English summary: Phase One gave every staff account the same
-- access. This adds an opt-in restriction: by default every account
-- keeps seeing everything ('all'), exactly as before. An admin can flip
-- a specific person to 'restricted' and pick which facilities they can
-- see — and, because residents, interactions, and tasks are all reached
-- through a facility, restricting facility access also restricts what
-- of those a restricted account can see.

alter table public.profiles
  add column facility_access_scope text not null default 'all'
    check (facility_access_scope in ('all', 'restricted'));

comment on column public.profiles.facility_access_scope is
  '''all'' (default) = sees every facility, same as Phase One. ''restricted'' = sees only the facilities listed for them in profile_facility_access.';

create table public.profile_facility_access (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  facility_id uuid not null references public.facilities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, facility_id)
);

comment on table public.profile_facility_access is
  'Which facilities a ''restricted'' profile is allowed to see. Ignored for profiles with facility_access_scope = ''all''.';

create index profile_facility_access_facility_id_idx on public.profile_facility_access (facility_id);

-- Note on schemas: this repo's committed migrations (and its local RLS
-- test harness, which builds a database from just those files) define
-- is_admin()/is_active_staff() in `public`. The real Supabase project
-- was separately hardened to keep these access-check helpers in a
-- `crm_private` schema instead, which PostgREST never exposes as
-- callable API endpoints — a stricter setup than what's on file here.
-- Rather than pick one and break the other, this migration makes sure
-- BOTH schemas have working copies (a same-body re-declaration is a
-- no-op wherever a function already exists), so the new access-check
-- functions below can be written once, in crm_private, and work the
-- same way in this repo's test harness and in the real project.
create schema if not exists crm_private;

create or replace function crm_private.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function crm_private.is_active_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

-- Extends the existing role/active protection (see profiles migration)
-- to also cover facility_access_scope: only an admin can loosen or
-- tighten someone's access, never the person themselves. Re-declared
-- under both possible names/schemas the trigger could be bound to (see
-- the schema note above) so whichever this environment actually uses
-- picks up the new check.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (
       new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.facility_access_scope is distinct from old.facility_access_scope
     )
     and not crm_private.is_admin() then
    raise exception 'Only an admin can change a profile''s role, active status, or facility access.';
  end if;
  return new;
end;
$$;

create or replace function crm_private.protect_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null
     and (
       new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.facility_access_scope is distinct from old.facility_access_scope
     )
     and not crm_private.is_admin() then
    raise exception 'Only an admin can change a profile''s role, active status, or facility access.';
  end if;
  return new;
end;
$$;

-- The central check used everywhere facility-scoped data is read or
-- written: "can the signed-in person see this facility?" A null
-- facility_id means the row isn't tied to any facility (e.g., a
-- general referral), so there's nothing to restrict.
create or replace function crm_private.can_access_facility(target_facility_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_facility_id is null
    or crm_private.is_admin()
    or not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.facility_access_scope = 'restricted'
    )
    or exists (
      select 1 from public.profile_facility_access pfa
      where pfa.profile_id = auth.uid() and pfa.facility_id = target_facility_id
    );
$$;

comment on function crm_private.can_access_facility(uuid) is
  'True if the signed-in person can see this facility: null facility, admin, an unrestricted (''all'') account, or an explicit grant in profile_facility_access all pass.';

-- Same idea, one hop further out: "can the signed-in person see this
-- resident?", by checking the facility that resident currently lives
-- at. A null resident_id means the row isn't tied to any resident.
create or replace function crm_private.can_access_resident(target_resident_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_resident_id is null
    or exists (
      select 1 from public.residents r
      where r.id = target_resident_id and crm_private.can_access_facility(r.current_facility_id)
    );
$$;

comment on function crm_private.can_access_resident(uuid) is
  'True if the signed-in person can see this resident, based on can_access_facility() for that resident''s current facility.';

alter table public.profile_facility_access enable row level security;

create policy "facility access grants are readable by active staff"
  on public.profile_facility_access for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "only admins manage facility access grants"
  on public.profile_facility_access for all
  to authenticated
  using (crm_private.is_admin())
  with check (crm_private.is_admin());

-- facilities: readable/editable only when accessible. Insert is left
-- open to any active staff member — a brand-new facility has no
-- restriction to check yet, and staff should always be able to log a
-- facility they've discovered even if it's outside their usual list.
drop policy "facilities are readable by active staff" on public.facilities;
create policy "facilities are readable by active staff"
  on public.facilities for select
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(id));

drop policy "active staff can update facilities" on public.facilities;
create policy "active staff can update facilities"
  on public.facilities for update
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(id));

-- residents: current_facility_id is required, so every resident is
-- always scoped by exactly one facility.
drop policy "residents are readable by active staff" on public.residents;
create policy "residents are readable by active staff"
  on public.residents for select
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(current_facility_id));

drop policy "active staff can add residents" on public.residents;
create policy "active staff can add residents"
  on public.residents for insert
  to authenticated
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(current_facility_id));

drop policy "active staff can update residents" on public.residents;
create policy "active staff can update residents"
  on public.residents for update
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(current_facility_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(current_facility_id));

-- facility_contacts: facility_id is required.
drop policy "facility contacts are readable by active staff" on public.facility_contacts;
create policy "facility contacts are readable by active staff"
  on public.facility_contacts for select
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id));

drop policy "active staff can add facility contacts" on public.facility_contacts;
create policy "active staff can add facility contacts"
  on public.facility_contacts for insert
  to authenticated
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id));

drop policy "active staff can update facility contacts" on public.facility_contacts;
create policy "active staff can update facility contacts"
  on public.facility_contacts for update
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id));

drop policy "active staff can remove facility contacts" on public.facility_contacts;
create policy "active staff can remove facility contacts"
  on public.facility_contacts for delete
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_facility(facility_id));

-- interactions: facility_id and resident_id are both optional, so both
-- checks are needed (either one being tied to an inaccessible facility
-- should hide the row).
drop policy "interactions are readable by active staff" on public.interactions;
create policy "interactions are readable by active staff"
  on public.interactions for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

drop policy "active staff can log interactions" on public.interactions;
create policy "active staff can log interactions"
  on public.interactions for insert
  to authenticated
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

drop policy "active staff can update interactions" on public.interactions;
create policy "active staff can update interactions"
  on public.interactions for update
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  )
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

-- interaction_volunteers: scoped through the interaction it belongs to.
drop policy "interaction volunteers are readable by active staff" on public.interaction_volunteers;
create policy "interaction volunteers are readable by active staff"
  on public.interaction_volunteers for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and exists (
      select 1 from public.interactions i
      where i.id = interaction_volunteers.interaction_id
        and crm_private.can_access_facility(i.facility_id)
        and crm_private.can_access_resident(i.resident_id)
    )
  );

drop policy "active staff can record interaction volunteers" on public.interaction_volunteers;
create policy "active staff can record interaction volunteers"
  on public.interaction_volunteers for insert
  to authenticated
  with check (
    crm_private.is_active_staff()
    and exists (
      select 1 from public.interactions i
      where i.id = interaction_volunteers.interaction_id
        and crm_private.can_access_facility(i.facility_id)
        and crm_private.can_access_resident(i.resident_id)
    )
  );

drop policy "active staff can remove interaction volunteers" on public.interaction_volunteers;
create policy "active staff can remove interaction volunteers"
  on public.interaction_volunteers for delete
  to authenticated
  using (
    crm_private.is_active_staff()
    and exists (
      select 1 from public.interactions i
      where i.id = interaction_volunteers.interaction_id
        and crm_private.can_access_facility(i.facility_id)
        and crm_private.can_access_resident(i.resident_id)
    )
  );

-- tasks: facility_id and resident_id are both optional, same as
-- interactions.
drop policy "tasks are readable by active staff" on public.tasks;
create policy "tasks are readable by active staff"
  on public.tasks for select
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

drop policy "active staff can add tasks" on public.tasks;
create policy "active staff can add tasks"
  on public.tasks for insert
  to authenticated
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

drop policy "active staff can update tasks" on public.tasks;
create policy "active staff can update tasks"
  on public.tasks for update
  to authenticated
  using (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  )
  with check (
    crm_private.is_active_staff()
    and crm_private.can_access_facility(facility_id)
    and crm_private.can_access_resident(resident_id)
  );

-- resident_contacts and resident_facility_history: scoped through the
-- resident they belong to.
drop policy "resident contacts are readable by active staff" on public.resident_contacts;
create policy "resident contacts are readable by active staff"
  on public.resident_contacts for select
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id));

drop policy "active staff can add resident contacts" on public.resident_contacts;
create policy "active staff can add resident contacts"
  on public.resident_contacts for insert
  to authenticated
  with check (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id));

drop policy "active staff can update resident contacts" on public.resident_contacts;
create policy "active staff can update resident contacts"
  on public.resident_contacts for update
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id))
  with check (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id));

drop policy "active staff can remove resident contacts" on public.resident_contacts;
create policy "active staff can remove resident contacts"
  on public.resident_contacts for delete
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id));

drop policy "facility history is readable by active staff" on public.resident_facility_history;
create policy "facility history is readable by active staff"
  on public.resident_facility_history for select
  to authenticated
  using (crm_private.is_active_staff() and crm_private.can_access_resident(resident_id));
