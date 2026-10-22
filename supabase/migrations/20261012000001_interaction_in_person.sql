-- Was someone from our staff physically there?
--
-- First added with QA-005 (approved Oct 12, 2026) and ALREADY APPLIED to
-- the live database on Oct 13, 2026 (every row null). This file records
-- it here so Build 3 can use it; `if not exists` makes it a no-op where
-- it already exists.
--
-- How it's used (decision B, director, Oct 19, 2026):
-- true  = in person. Every On-Site entry sets it; on the regular form a
--         staff conversation has an "In person?" tick, unticked by default.
-- null  = not recorded. Existing records stay null and are never assumed
--         to be visits (an older staff conversation may have been a call).
--
-- A staff conversation with in_person = true makes a facility visit-day
-- (one per facility per day) -- see visitDayKey in
-- src/lib/queries/report-rules.ts. Phone calls and emails never do.
--
-- Rollback: alter table public.interactions drop column in_person;

alter table public.interactions add column if not exists in_person boolean;

comment on column public.interactions.in_person is
  'true when our staff were physically there (set on site, or ticked on a staff conversation); null = not recorded. Never inferred for older records.';
