-- Follow-up tasks can be connected to a resident, facility, or contact
-- (see 20260727000011_tasks.sql) — this adds the fourth connection
-- called for by ROADMAP.md's Follow-Up Tasks feature: linking a task
-- directly to the interaction that prompted it (e.g., "family asked
-- about kosher meals during today's visit" becomes both a logged
-- interaction and a follow-up task pointing back to it).

alter table public.tasks
  add column interaction_id uuid references public.interactions (id);

create index tasks_interaction_id_idx on public.tasks (interaction_id);
