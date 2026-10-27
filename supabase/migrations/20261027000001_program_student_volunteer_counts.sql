-- October 27 cleanup (director, Oct 27, 2026). Add-only: two new number
-- fields on activities; nothing existing is changed, moved or deleted.
--
-- A program (or school & shul program) now asks two numbers instead of
-- one: students who took part and volunteers who took part (residents
-- reached stays as it is). The older single number, participants, is
-- kept exactly as saved; reports show it as "Not split" wherever the
-- breakdown isn't known.
--
-- Like participants, both are held once on a group project's first
-- activity; activities "Part of" it leave them empty.
--
-- Undo: supabase/rollback/20261027000001_program_student_volunteer_counts_undo.sql

alter table public.interactions
  add column if not exists student_count integer check (student_count >= 0),
  add column if not exists volunteer_count integer check (volunteer_count >= 0);

comment on column public.interactions.student_count is
  'Students who took part in a program (Oct 27, 2026). Empty on entries saved before then.';
comment on column public.interactions.volunteer_count is
  'Volunteers who took part in a program (Oct 27, 2026). Empty on entries saved before then; their single number (participants) is shown as "Not split".';
