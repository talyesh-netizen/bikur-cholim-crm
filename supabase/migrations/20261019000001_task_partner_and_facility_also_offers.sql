-- Build 3 cleanup (director, Oct 19, 2026). Add-only: two new fields,
-- nothing existing is changed, moved or deleted.
--
-- 1. A task added from a Strategic Partner's page is linked to that
--    partner, the way tasks already link to a resident, facility or
--    contact.
-- 2. A facility can offer more than one kind of care ("Assisted living"
--    and also "Memory care"). The main type stays exactly as it is, so
--    every filter and report keeps working; the extra kinds sit beside
--    it. Every existing facility starts with none.

alter table public.tasks
  add column if not exists organization_id uuid references public.organizations (id);

comment on column public.tasks.organization_id is
  'The Strategic Partner (school, shul, organization) this task is about, when added from its page.';

create index if not exists tasks_organization_id_idx
  on public.tasks (organization_id) where organization_id is not null;

alter table public.facilities
  add column if not exists also_offers text[] not null default '{}';

comment on column public.facilities.also_offers is
  'Other kinds of care offered besides the main facility_type (e.g. memory_care at an assisted living). Reports group by facility_type.';

alter table public.facilities drop constraint if exists facilities_also_offers_check;
alter table public.facilities add constraint facilities_also_offers_check
  check (also_offers <@ array[
    'nursing_home',
    'assisted_living',
    'rehabilitation_center',
    'memory_care',
    'independent_living',
    'senior_apartment',
    'continuing_care',
    'hospital',
    'other'
  ]::text[]);
