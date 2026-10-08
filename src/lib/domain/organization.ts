/**
 * Organization-related types and option lists (synagogues, schools,
 * and other community partner organizations). Must stay in sync with
 * the CHECK constraint in supabase/migrations/20260920000005_organizations.sql
 * — see the same note in facility.ts for why.
 */

export { labelFor } from "./options";

export const ORGANIZATION_TYPES = [
  { value: "synagogue", label: "Shul" },
  { value: "school", label: "School" },
  { value: "jewish_organization", label: "Jewish organization" },
  { value: "healthcare_group", label: "Healthcare group" },
  // Older values, still valid (see 20261008000001_healthcare_groups.sql).
  { value: "outreach_center", label: "Outreach center" },
  { value: "community_partner", label: "Community partner" },
  { value: "other", label: "Other" },
] as const;

/** Two worlds (decided Oct 8, 2026): Strategic Partners are the Jewish
 * community that helps us; healthcare groups own the facilities we
 * serve and sit at the top of Group > Facility > Residents > Family. */
export const OFFERED_PARTNER_TYPES = ["synagogue", "school", "jewish_organization"] as const;
export const HEALTHCARE_GROUP = "healthcare_group";

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]["value"];

export type Organization = {
  id: string;
  name: string;
  organization_type: OrganizationType;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  main_phone: string | null;
  website: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  parent_organization_id: string | null;
};

/** An organization_contacts row plus the linked contact's own fields,
 * for display on an organization's page. */
export type OrganizationContact = {
  id: string;
  organization_id: string;
  contact_id: string;
  role_at_organization: string | null;
  is_primary_contact: boolean;
  active: boolean;
  contact: import("./contact").Contact;
};
