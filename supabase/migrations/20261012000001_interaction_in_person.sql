-- Was someone from our staff physically there? (QA-005, approved by the
-- director after ChatGPT QA review, Oct 12, 2026.)
--
-- true  = in person. Only the on-site "Start visit here" screen sets it,
--         because being on that screen is what reliably shows presence.
-- null  = not recorded. Every existing record stays null: an older staff
--         or family conversation could have been a phone call, so it is
--         never assumed to be a visit.
--
-- Facility visit-days (one per facility per day) count entries with
-- in_person = true plus resident visits and facility visits -- see
-- countFacilityVisitDays in src/lib/queries/interactions.ts.
--
-- Adds one nullable column; no existing row, report or access rule
-- changes. Rollback: alter table public.interactions drop column in_person;

alter table public.interactions add column if not exists in_person boolean;

comment on column public.interactions.in_person is
  'true when logged on the on-site screen (staff were physically there); null = not recorded. Never inferred for older records.';
