-- UNDO for 20261027000001_program_student_volunteer_counts.sql.
--
-- Use only with putting the earlier code back live (Vercel Instant
-- Rollback); the newer code reads these columns.
--
-- What is LOST: the student and volunteer numbers entered on programs
-- since the change. Check first:
--   select count(*) filter (where student_count is not null) students,
--          count(*) filter (where volunteer_count is not null) volunteers
--     from public.interactions;

alter table public.interactions
  drop column if exists student_count,
  drop column if exists volunteer_count;
