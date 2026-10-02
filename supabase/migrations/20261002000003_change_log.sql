-- Change history: every edit (and removal) of a core record is written
-- here automatically by the database -- who, when, and each field's old
-- and new value -- so a mistaken edit can always be seen and put back.
--
-- * Written only by the trigger below; no one can add, edit, or erase
--   entries through the app (no insert/update/delete policies).
-- * Readable by admins only: entries can contain old private notes.
-- * changed_by is null for direct database edits (e.g. SQL clean-up).
-- * Deliberately no foreign key on changed_by, so logging can never
--   block a save.

create table if not exists public.change_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  changes jsonb not null
);

create index if not exists change_log_record_idx on public.change_log (table_name, record_id, changed_at desc);
create index if not exists change_log_changed_at_idx on public.change_log (changed_at desc);

alter table public.change_log enable row level security;

create policy "admins can read the change log"
  on public.change_log for select
  to authenticated
  using (crm_private.is_admin());

revoke insert, update, delete, truncate on public.change_log from anon, authenticated;

create or replace function crm_private.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- DELETE: keep the whole row as it was.
  insert into public.change_log (table_name, record_id, action, changed_by, changes)
  values (tg_table_name, old.id, 'delete', auth.uid(), v_old);
  return old;
end;
$$;

revoke all on function crm_private.log_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'residents', 'resident_contacts', 'contacts', 'facilities', 'facility_contacts',
    'interactions', 'tasks', 'organizations', 'organization_contacts'
  ] loop
    execute format(
      'create trigger log_changes after update or delete on public.%I for each row execute function crm_private.log_change()',
      t
    );
  end loop;
end;
$$;
