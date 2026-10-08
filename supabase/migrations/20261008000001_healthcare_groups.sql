-- Two worlds, decided by the director (Oct 8, 2026):
--   * Healthcare groups own the facilities we serve (plus hospice / home
--     care providers) -- they sit at the top of the chain
--     Healthcare group > Facility > Staff & Residents > Family.
--   * Strategic Partners are the Jewish community -- shuls, schools and
--     Jewish organizations that help with volunteers.
-- Adds the two new organization types and sorts the existing records.
-- Nothing is deleted; every contact stays linked to its organization.

alter table public.organizations drop constraint organizations_organization_type_check;
alter table public.organizations add constraint organizations_organization_type_check
  check (organization_type = any (array[
    'synagogue', 'school', 'jewish_organization', 'healthcare_group',
    -- older values, kept valid
    'outreach_center', 'community_partner', 'other'
  ]));

-- The 24 "Other" organizations are all facility owners or care
-- providers (CommuniCare, Saber, Vitalia, Harmony Hospice, ...).
update public.organizations set organization_type = 'healthcare_group'
  where organization_type = 'other';

-- Chabad houses, the Federation, JECC, jHUB.
update public.organizations set organization_type = 'jewish_organization'
  where organization_type in ('outreach_center', 'community_partner');

-- Both Eliza Jennings buildings belong to the Eliza Jennings group.
update public.facilities set parent_healthcare_group = 'Eliza Jennings'
  where name ilike 'Eliza Jennings%' and coalesce(parent_healthcare_group, '') = '';
