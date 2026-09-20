-- Deactivate instead of delete for contact links: removing a family
-- member from a resident, a staffer from a facility, or a contact from
-- an organization now flips `active` to false instead of deleting the
-- row, so "who used to be connected, and when" is never silently lost
-- -- the same deactivate-not-delete pattern already used for contacts
-- themselves (contacts.active) and residents/facilities/organizations.
-- See ROADMAP.md's "Deletion and History" rule.

alter table public.resident_contacts add column active boolean not null default true;
alter table public.facility_contacts add column active boolean not null default true;
alter table public.organization_contacts add column active boolean not null default true;

comment on column public.resident_contacts.active is
  'False means this link was removed by staff. The row (and its history) stays -- deactivate, never delete.';
comment on column public.facility_contacts.active is
  'False means this link was removed by staff. The row (and its history) stays -- deactivate, never delete.';
comment on column public.organization_contacts.active is
  'False means this link was removed by staff. The row (and its history) stays -- deactivate, never delete.';

-- Replace the always-unique constraints with active-only ones, so a
-- contact can be re-linked (a fresh active row) after a previous link
-- to the same resident/facility/organization was deactivated.
alter table public.resident_contacts drop constraint resident_contacts_unique;
create unique index resident_contacts_unique_active_idx
  on public.resident_contacts (resident_id, contact_id, relationship_to_resident)
  where (active);

alter table public.facility_contacts drop constraint facility_contacts_unique;
create unique index facility_contacts_unique_active_idx
  on public.facility_contacts (facility_id, contact_id)
  where (active);

alter table public.organization_contacts drop constraint organization_contacts_unique;
create unique index organization_contacts_unique_active_idx
  on public.organization_contacts (organization_id, contact_id)
  where (active);

-- The "one primary per X" rule should only apply among active links, so
-- a deactivated old primary link can never block designating a new one.
drop index public.resident_contacts_one_primary_per_resident_idx;
create unique index resident_contacts_one_primary_per_resident_idx
  on public.resident_contacts (resident_id)
  where (is_primary_contact and active);

drop index public.facility_contacts_one_primary_per_facility_idx;
create unique index facility_contacts_one_primary_per_facility_idx
  on public.facility_contacts (facility_id)
  where (is_primary_contact and active);

drop index public.organization_contacts_one_primary_per_org_idx;
create unique index organization_contacts_one_primary_per_org_idx
  on public.organization_contacts (organization_id)
  where (is_primary_contact and active);
