-- resident_facility_history: the full timeline of which facility a
-- resident has been at, and when.
--
-- Plain-English summary: this table is what makes "move a resident to
-- another facility without losing history" work. Every stay at a
-- facility is one row: which resident, which facility, when it started,
-- and (once they leave) when it ended. A resident's page can always
-- show "currently at Facility B, previously at Facility A from March to
-- July" by reading this table — nothing about a past stay is ever
-- deleted or overwritten.

create table public.resident_facility_history (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id),
  facility_id uuid not null references public.facilities (id),
  start_date date not null default current_date,
  end_date date,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint resident_facility_history_dates_check check (end_date is null or end_date >= start_date)
);

comment on table public.resident_facility_history is
  'Full timeline of every facility a resident has stayed at. Rows are only ever added, never edited or removed, by the normal app workflow — this is the historical record.';
comment on column public.resident_facility_history.end_date is
  'Null means the resident is still there. Set automatically when the resident is moved to a different facility.';

create index resident_facility_history_resident_id_idx on public.resident_facility_history (resident_id);
create index resident_facility_history_facility_id_idx on public.resident_facility_history (facility_id);

-- At most one "current" (end_date is null) stay per resident at a time.
-- This protects against a bug or mistake ever leaving a resident with
-- two "active" facility stays at once, which would make their current
-- facility ambiguous.
create unique index resident_facility_history_one_open_stay_idx
  on public.resident_facility_history (resident_id)
  where (end_date is null);

alter table public.resident_facility_history enable row level security;

create policy "facility history is readable by active staff"
  on public.resident_facility_history for select
  to authenticated
  using (public.is_active_staff());

-- There is deliberately no insert/update policy here for regular use.
-- Rows in this table are written automatically by the two trigger
-- functions below, never directly by the app — see the explanation
-- above each one.

-- Automatically starts a resident's facility history the moment they
-- are added to the system, so every resident always has exactly one
-- "current" stay recorded from day one, without staff having to do
-- anything extra.
create or replace function public.create_initial_facility_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.resident_facility_history (resident_id, facility_id, start_date, created_by)
  values (new.id, new.current_facility_id, current_date, new.created_by);
  return new;
end;
$$;

create trigger create_initial_facility_history
  after insert on public.residents
  for each row execute function public.create_initial_facility_history();

-- The heart of "move a resident without losing history": whenever a
-- resident's current_facility_id actually changes (however that change
-- happens — through the app's "Move to another facility" action or any
-- other path), this trigger keeps resident_facility_history correct
-- automatically: it closes out the stay that just ended and opens a new
-- one at the new facility. Because this lives on the table itself
-- rather than relying on the app to remember every step, the history
-- can never accidentally fall out of sync with a resident's actual
-- current facility.
create or replace function public.record_facility_transfer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.current_facility_id is distinct from old.current_facility_id then
    update public.resident_facility_history
      set end_date = current_date
      where resident_id = new.id and end_date is null;

    insert into public.resident_facility_history (resident_id, facility_id, start_date)
      values (new.id, new.current_facility_id, current_date);
  end if;
  return new;
end;
$$;

create trigger record_facility_transfer
  after update of current_facility_id on public.residents
  for each row execute function public.record_facility_transfer();
