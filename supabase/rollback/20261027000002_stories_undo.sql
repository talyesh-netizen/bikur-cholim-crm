-- UNDO for 20261027000002_stories.sql.
--
-- Use only with putting the earlier code back live (Vercel Instant
-- Rollback); the newer code reads this table.
--
-- What is LOST: every story written since the change (their edit history
-- stays in the change log). Check first, and export them if needed:
--   select count(*) from public.stories;

drop table if exists public.stories;
drop function if exists crm_private.can_see_unlinked_story(uuid, uuid, uuid);
