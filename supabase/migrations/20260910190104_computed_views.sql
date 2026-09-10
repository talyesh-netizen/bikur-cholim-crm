-- Computed views: "last visit date" and similar fields that are looked
-- up from the interaction log / tasks rather than typed in by hand, so
-- they can never quietly go stale. See DATABASE.md for why.
--
-- Views inherit the row-level security of the underlying tables they
-- query (Postgres enforces this automatically for views owned the same
-- way as the tables), so no separate security rules are needed here.

-- Which interaction types count as an actual visit to a facility, for
-- the purposes of "last visit date." A phone call or email does not
-- count as a visit.
create or replace view public.facility_summary with (security_invoker = true) as
select
  f.*,
  gc.name as geographic_cluster_name,
  (
    select max(i.occurred_at)
    from public.interactions i
    where i.facility_id = f.id
      and i.interaction_type in ('resident_visit', 'facility_discovery_visit', 'volunteer_visit', 'program')
  ) as last_visit_at,
  (
    select count(*)
    from public.residents r
    where r.current_facility_id = f.id
      and r.status = 'active'
  ) as active_resident_count
from public.facilities f
left join public.geographic_clusters gc on gc.id = f.geographic_cluster_id;

comment on view public.facility_summary is
  'Facilities plus their computed last visit date (from the interaction log) and current active resident count. Read from this view instead of the raw facilities table when you need those fields.';

create or replace view public.resident_summary with (security_invoker = true) as
select
  r.*,
  f.name as current_facility_name,
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
  'Residents plus their computed last visit date (from the interaction log), computed next follow-up date (earliest due date among their open tasks), current facility name, and a pointer to their Primary Contact link if one exists.';
