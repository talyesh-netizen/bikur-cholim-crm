-- A resident's first or last name may be unknown. At least one of the two
-- must be present; the missing one is stored as null, never guessed.
alter table public.residents alter column first_name drop not null;
alter table public.residents alter column last_name drop not null;
alter table public.residents drop constraint if exists residents_has_a_name;
alter table public.residents add constraint residents_has_a_name
  check (btrim(coalesce(first_name, '')) <> '' or btrim(coalesce(last_name, '')) <> '');
