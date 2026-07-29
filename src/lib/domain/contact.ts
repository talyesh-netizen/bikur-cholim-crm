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
  contact: Contact;
};
