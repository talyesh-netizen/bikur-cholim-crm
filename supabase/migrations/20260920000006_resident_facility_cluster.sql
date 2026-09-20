-- Adds the resident's current facility's geographic cluster to
-- resident_summary, so the app can color a resident's card/profile by
-- the same cluster color already used for that facility -- without a
-- second round trip per resident just to look it up.
--
-- Dropped and recreated rather than CREATE OR REPLACE: the live view's
-- `r.*` expansion had drifted from what a plain CREATE OR REPLACE
-- expects (Postgres freezes a view's `select *` columns at creation
-- time, so a column added to residents afterwards, like
-- referral_source, was never in the old view's frozen column list),
-- and CREATE OR REPLACE VIEW cannot change existing column
-- positions/names. Nothing else depends on this view (checked via
-- pg_depend before applying), so a plain drop + recreate is safe.
--
-- security_invoker = true: the live view already had this set (a
-- hardening applied directly on the database, same kind of drift noted
-- in 20260920000003_facility_access_scope.sql for other objects, and
-- also present on facility_summary). Without it, the view runs with
-- its owner's privileges instead of the querying user's, silently
-- bypassing every RLS policy on residents/facilities for whoever reads
-- it. A plain drop + recreate loses this option, so it's set explicitly
-- here to keep behaving exactly as it does live.

drop view if exists public.resident_summary;

create view public.resident_summary
with (security_invoker = true)
as
select
  r.*,
  f.name as current_facility_name,
  f.geographic_cluster_id as current_facility_cluster_id,
  (
    select max(i.occurred_at)
    from public.interactions i
    where i.resident_id = r.id
      and i.interaction_type in ('resident_visit', 'volunteer_visit')
  ) as last_visit_at,
  (
    select min(t.due_date)
    from public.tasks t
    where t.resident_id = r.id
      and t.status in ('open', 'in_progress', 'waiting')
      and t.due_date is not null
  ) as next_follow_up_date,
  (
    select pc.id
    from public.resident_contacts pc
    where pc.resident_id = r.id and pc.is_primary_contact = true
    limit 1
  ) as primary_contact_resident_contact_id
from public.residents r
left join public.facilities f on f.id = r.current_facility_id;

comment on view public.resident_summary is
  'Residents plus their computed last visit date (from the interaction log), computed next follow-up date (earliest due date among their open tasks), current facility name and geographic cluster, and a pointer to their Primary Contact link if one exists.';
