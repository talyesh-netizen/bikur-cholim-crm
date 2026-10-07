/**
 * Contact-related types and option lists. Must stay in sync with the
 * CHECK constraints in supabase/migrations/20260727000007_contacts.sql
 * and 20260727000008_resident_contacts.sql — see the same note in
 * src/lib/domain/facility.ts for why.
 */

export { labelFor } from "./options";

export const CONTACT_TYPES = [
  { value: "family_member", label: "Family member" },
  { value: "rabbi", label: "Rabbi" },
  { value: "synagogue_contact", label: "Synagogue contact" },
  { value: "facility_staff", label: "Facility staff" },
  { value: "community_partner", label: "Community partner" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other_referral_source", label: "Other referral source" },
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number]["value"];

// A contact who has left their role reads better as "Left role" than
// the generic "Inactive" — it's the far more common reason a facility
// staff or community contact gets deactivated here.
const LEFT_ROLE_TYPES = new Set<ContactType>(["facility_staff", "community_partner", "rabbi", "synagogue_contact"]);

export function inactiveContactLabel(contactType: ContactType): string {
  return LEFT_ROLE_TYPES.has(contactType) ? "Left role" : "Inactive";
}

/** What decides a contact's main color/identity in the app -- see
 * primary_profile_kind on the contacts table. */
export const PRIMARY_PROFILE_KINDS = [
  { value: "contact_type", label: "Their type (default)" },
  { value: "facility", label: "Their facility" },
  { value: "organization", label: "Their shul/school/partner" },
] as const;

export type PrimaryProfileKind = (typeof PRIMARY_PROFILE_KINDS)[number]["value"];

/** Volunteer-only profile fields -- meaningful only when
 * contact_type = "volunteer", but stored on every contact (see the
 * migration for why). */
export const BACKGROUND_CHECK_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "pending", label: "Pending" },
  { value: "cleared", label: "Cleared" },
  { value: "expired", label: "Expired" },
] as const;

export type BackgroundCheckStatus = (typeof BACKGROUND_CHECK_STATUSES)[number]["value"];

/** Quick-filter groupings shown as tabs on the contacts list, so staff
 * can jump straight to "the volunteers" or "the shul contacts" instead
 * of always browsing one flat list. Purely a UI grouping over
 * contact_type — it doesn't change what's stored. */
export const CONTACT_QUICK_FILTERS = [
  { key: "facility_staff", label: "Facility staff", types: ["facility_staff"] as ContactType[] },
  { key: "family", label: "Family", types: ["family_member"] as ContactType[] },
  { key: "volunteers", label: "Volunteers", types: ["volunteer"] as ContactType[] },
  {
    key: "shul_community",
    label: "Shul & community",
    types: ["rabbi", "synagogue_contact", "community_partner"] as ContactType[],
  },
  { key: "other", label: "Other", types: ["other_referral_source"] as ContactType[] },
] as const;

export const PREFERRED_COMMUNICATION_METHODS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "mail", label: "Mail" },
  { value: "no_preference", label: "No preference" },
] as const;

export const RESIDENT_CONTACT_RELATIONSHIPS = [
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "spouse", label: "Spouse" },
  { value: "sibling", label: "Sibling" },
  { value: "grandchild", label: "Grandchild" },
  { value: "power_of_attorney", label: "Power of attorney" },
  { value: "friend", label: "Friend" },
  { value: "rabbi", label: "Rabbi" },
  { value: "other", label: "Other" },
] as const;

export type Contact = {
  id: string;
  name: string;
  organization: string | null;
  contact_type: ContactType;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  preferred_communication_method: string | null;
  notes: string | null;
  active: boolean;
  primary_profile_kind: PrimaryProfileKind;
  background_check_status: BackgroundCheckStatus;
  background_check_date: string | null;
  availability_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** A resident_contacts row plus the linked contact's own fields, for
 * display on a resident's page. */
export type ResidentContact = {
  id: string;
  resident_id: string;
  contact_id: string;
  relationship_to_resident: string;
  relationship_other_description: string | null;
  is_primary_contact: boolean;
  relationship_notes: string | null;
  active: boolean;
  contact: Contact;
};

/** A facility_contacts row plus the linked contact's own fields, for
 * display on a facility's page. */
export type FacilityContact = {
  id: string;
  facility_id: string;
  contact_id: string;
  role_at_facility: string | null;
  is_primary_contact: boolean;
  active: boolean;
  contact: Contact;
};

/** "With Bob Gottfried (spouse)" -- who an interaction was with, so a
 * family conversation filed under a resident reads as support for the
 * family member, not the resident. */
export function withContactLabel(name: string | null, relationship: string | null): string | null {
  if (!name) return null;
  const rel = RESIDENT_CONTACT_RELATIONSHIPS.find((r) => r.value === relationship)?.label;
  return `With ${name}${rel ? ` (${rel.toLowerCase()})` : ""}`;
}
