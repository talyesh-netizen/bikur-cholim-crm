-- UNDO for Build 2's database change (20261017000001_activity_logging.sql).
--
-- Use only in an emergency, and only together with putting the pre-Build-2
-- code back live. The two must move together: Build 2's code needs these
-- tables and fields, and the older code breaks while they exist (the
-- second link from interactions to profiles, entered_by, makes its
-- "profiles(full_name)" lookups ambiguous).
--
-- What is LOST when this runs: everything recorded only through Build 2 --
-- staff spoken with / present (interaction_contacts), team members
-- (interaction_team_members), partners on activities, who typed each entry,
-- "Part of" links, double-entry answers and saved quarter totals. Download
-- a backup first (More -> Backup); the Build 2 backup includes all of them.
-- Every activity itself (interactions rows) is kept.
--
-- Order: first a backup, then this script, then roll the code back in
-- Vercel (Instant Rollback to the last pre-Build-2 production deployment).
--
-- NOT YET REHEARSED. Before relying on it, run it on the practice database
-- followed by the Build 2 migration again, then check the app still works.

begin;

drop trigger if exists protect_counted_in on public.interactions;
drop function if exists crm_private.protect_counted_in();
drop function if exists public.undo_double_entry_review(uuid);
drop function if exists public.review_double_entry(uuid, uuid, text);
drop function if exists public.set_interaction_people(uuid, uuid[], uuid[], uuid[]);

drop table if exists public.report_snapshots;
drop table if exists public.duplicate_reviews;
drop table if exists public.interaction_team_members;
drop table if exists public.interaction_contacts;

alter table public.interactions
  drop constraint if exists interactions_not_part_of_self,
  drop constraint if exists interactions_not_counted_in_self;

-- Their indexes go with them.
alter table public.interactions
  drop column if exists counted_in_id,
  drop column if exists part_of_id,
  drop column if exists entered_by,
  drop column if exists partner_organization_id;

commit;
