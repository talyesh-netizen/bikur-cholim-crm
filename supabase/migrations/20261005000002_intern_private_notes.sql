-- Intern access (authorized by the director, Oct 5 2026): interns do the
-- daily work but never see private notes.
--
-- Private notes move out of residents.private_internal_notes into their
-- own table, readable only by active staff and admins (and still subject
-- to facility access). Writes keep working as before: anything written to
-- residents.private_internal_notes (app, Quick Log, direct SQL) is filed
-- into resident_private_notes by a trigger, and the column is always left
-- empty. resident_summary.private_internal_notes reads from the new table,
-- so for interns it is simply null.
--
-- IMPORTANT for direct SQL: residents.private_internal_notes now always
-- reads as null. Read notes from resident_summary or
-- resident_private_notes. Writing to the column REPLACES the notes, so
-- never build a new value from the (empty) column.

-- 1. Third account level.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('staff', 'admin', 'intern'));

-- 2. Who may see private notes.
create or replace function crm_private.can_see_private_notes()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true and role in ('staff', 'admin')
  );
$$;

-- 3. The notes table (written only by the trigger in step 5).
create table if not exists public.resident_private_notes (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null unique
    references public.residents(id) on delete cascade
    deferrable initially deferred,
  notes text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.resident_private_notes enable row level security;
create policy "staff and admins can read private notes"
  on public.resident_private_notes for select
  to authenticated
  using (crm_private.can_see_private_notes() and crm_private.can_access_resident(resident_id));
revoke insert, update, delete, truncate on public.resident_private_notes from anon, authenticated;
grant select on public.resident_private_notes to authenticated;
create trigger log_changes after update or delete on public.resident_private_notes
  for each row execute function crm_private.log_change();

-- 4. Copy every existing note exactly.
insert into public.resident_private_notes (resident_id, notes)
select id, private_internal_notes from public.residents
where btrim(coalesce(private_internal_notes, '')) <> ''
on conflict (resident_id) do nothing;

-- 5. File anything written to the old column into the new table.
create or replace function crm_private.route_private_notes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if btrim(coalesce(new.private_internal_notes, '')) <> ''
     and (auth.uid() is null or crm_private.can_see_private_notes()) then
    insert into public.resident_private_notes (resident_id, notes, updated_by)
    values (new.id, new.private_internal_notes, auth.uid())
    on conflict (resident_id) do update
      set notes = excluded.notes, updated_at = now(), updated_by = excluded.updated_by
      where public.resident_private_notes.notes is distinct from excluded.notes;
  end if;
  new.private_internal_notes := null;
  return new;
end;
$$;
revoke all on function crm_private.route_private_notes() from public, anon, authenticated;
create trigger route_private_notes before insert or update on public.residents
  for each row execute function crm_private.route_private_notes();

-- 6. resident_summary reads notes from the new table (null for interns).
create or replace view public.resident_summary with (security_invoker = true) as
select r.id, r.first_name, r.last_name, r.preferred_name, r.current_facility_id, r.room_number, r.phone_number,
  r.rabbi_synagogue_connection, r.jewish_interests_background, r.kosher_food_needs, r.holiday_support_needs,
  r.visitation_needs, r.preferred_visit_frequency, r.status,
  (select n.notes from public.resident_private_notes n where n.resident_id = r.id) as private_internal_notes,
  r.created_by, r.created_at, r.updated_at, r.referral_source,
  f.name as current_facility_name, f.geographic_cluster_id as current_facility_cluster_id,
  (select max(i.occurred_at) from public.interactions i
    where i.resident_id = r.id and i.interaction_type in ('resident_visit', 'volunteer_visit')) as last_visit_at,
  (select min(t.due_date) from public.tasks t
    where t.resident_id = r.id and t.status in ('open', 'in_progress', 'waiting') and t.due_date is not null) as next_follow_up_date,
  (select pc.id from public.resident_contacts pc
    where pc.resident_id = r.id and pc.is_primary_contact = true limit 1) as primary_contact_resident_contact_id,
  r.sex, f.facility_type as current_facility_type
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;

-- 7. Empty the old column (copies made in step 4 and verified before
--    this ran; old values are also kept in change_log). updated_at is
--    left untouched.
alter table public.residents disable trigger set_updated_at;
update public.residents set private_internal_notes = null where private_internal_notes is not null;
alter table public.residents enable trigger set_updated_at;
