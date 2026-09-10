-- Follow-up tasks can be connected to a resident, facility, or contact
-- (see 20260910190057_tasks.sql) — this adds the fourth connection
-- called for by ROADMAP.md's Follow-Up Tasks feature: linking a task
-- directly to the interaction that prompted it (e.g., "family asked
-- about kosher meals during today's visit" becomes both a logged
-- interaction and a follow-up task pointing back to it).

alter table public.tasks
  add column interaction_id uuid references public.interactions (id);

create index tasks_interaction_id_idx on public.tasks (interaction_id);

-- Explicit API privileges: only approved staff can access CRM records.
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.geographic_clusters, public.facilities, public.residents, public.contacts, public.interactions, public.tasks to authenticated;
grant select, insert, update, delete on public.resident_contacts, public.facility_contacts to authenticated;
grant select, insert, delete on public.interaction_volunteers to authenticated;
grant select on public.resident_facility_history, public.facility_summary, public.resident_summary to authenticated;
revoke all on all functions in schema crm_private from public, anon, authenticated;
grant execute on function crm_private.is_admin(), crm_private.is_active_staff() to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
