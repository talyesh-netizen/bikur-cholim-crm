-- geographic_clusters: the admin-managed list of regions used to group
-- facilities (e.g., "East Side," "Akron area").
--
-- Plain-English summary: instead of staff typing a region name into a
-- free-text box (which drifts — "East Side" vs "east side" vs
-- "Eastside"), every facility points at one row in this table. An Admin
-- can add, rename, or retire a cluster from a settings screen; nothing
-- about that requires a code change.

create table public.geographic_clusters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geographic_clusters_name_unique unique (name)
);

comment on table public.geographic_clusters is
  'Admin-managed list of geographic regions used to group facilities for planning, reporting, and (in later phases) route planning.';
comment on column public.geographic_clusters.active is
  'Retiring a cluster sets this to false rather than deleting the row, so facilities already assigned to it keep working and history stays intact. Retired clusters are hidden from the picker when adding new facilities.';

create trigger set_updated_at
  before update on public.geographic_clusters
  for each row execute function public.set_updated_at();

alter table public.geographic_clusters enable row level security;

-- Any active staff member can view the cluster list (needed to fill out
-- a facility form), but only Admins can add, rename, or retire one.
create policy "clusters are readable by active staff"
  on public.geographic_clusters for select
  to authenticated
  using (crm_private.is_active_staff());

create policy "only admins manage clusters"
  on public.geographic_clusters for all
  to authenticated
  using (crm_private.is_admin())
  with check (crm_private.is_admin());
