-- Which holiday an activity was for (director-approved simplification of
-- interaction types, Oct 5 2026). Replaces year-specific types like
-- "Purim Program '26": that is now type=program, holiday=purim, and the
-- year comes from occurred_at. Optional; existing rows stay null.
alter table public.interactions add column if not exists holiday text;
alter table public.interactions add constraint interactions_holiday_check
  check (holiday is null or holiday in ('shabbos', 'rosh_hashana', 'yom_kippur', 'sukkos', 'chanukah', 'tu_bshvat', 'purim', 'pesach', 'shavuos'));
