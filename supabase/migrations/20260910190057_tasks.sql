-- tasks: the follow-up / to-do system.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
  assigned_to uuid references public.profiles (id),
  facility_id uuid references public.facilities (id),
  resident_id uuid references public.residents (id),
  contact_id uuid references public.contacts (id),
  task_category text not null check (task_category in (
    'visit',
    'phone_call',
    'family_follow_up',
    'facility_follow_up',
    'volunteer_coordination',
    'program_planning',
    'kosher_food',
    'referral',
    'hospital_follow_up',
    'resident_transition',
    'other'
  )),
  completion_notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is
  'Follow-up items. Related facility/resident/contact are all optional — a task can stand alone.';
comment on column public.tasks.completion_notes is
  'Filled in when a task is marked Completed, describing what was actually done.';

create index tasks_status_idx on public.tasks (status);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_facility_id_idx on public.tasks (facility_id);
create index tasks_resident_id_idx on public.tasks (resident_id);

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks are readable by active staff"
  on public.tasks for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "active staff can add tasks"
  on public.tasks for insert
  to authenticated
  with check (crm_private.is_active_staff());

create policy "active staff can update tasks"
  on public.tasks for update
  to authenticated
  using (crm_private.is_active_staff())
  with check (crm_private.is_active_staff());
